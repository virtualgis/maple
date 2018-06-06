/* Maple - A Modern Web Mapping Application
* 
* Copyright (C) 2018 VirtualGIS
* 
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
* 
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
* 
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>. */
define([
	"dojo/dom", "dojo/has", "dojo/dom-attr", "dojo/dom-style", "dojo/query", "esri/map",  "dojo/on",
	"esri/dijit/Scalebar", "esri/geometry/Point",
	"maple/helpers/map/layers", "maple/helpers/map/search",
	"esri/dijit/Search", "maple/helpers/auth", "dojox/mobile/TransitionEvent",
	"esri/dijit/LocateButton", "maple/config/server",
	"maple/config/project", "dijit/registry", "maple/helpers/map/popup", "maple/helpers/map/infoTemplate",
	"esri/layers/GraphicsLayer", "dojo/topic", "maple/widgets/SideMenu",
	"maple/helpers/utils", "dojox/widget/Toaster", "dojo/_base/array",
	"dojo/dom-construct", "dojo/dnd/Moveable", "dojo/dom-class",
	"dojo/NodeList-traverse", "dojo/NodeList-dom", "dojo/domReady!"
	], function(
			dom, has, domAttr, domStyle, query, Map, on,
			Scalebar, Point, mapLayers, mapSearch,
			Search, auth, TransitionEvent,
			LocateButton, server,
			project, registry, popup, infoTemplate,
			GraphicsLayer, topic, SideMenu, utils, Toaster, array,
			domConstruct, Moveable, domClass
		){
		"use strict";

		var iOS = utils.getPlatform() === "iOS";
		
		function goToLoginScreen(reload){
			if (!reload){
				new TransitionEvent(dom.byId("map"),{
					target: "app"
				}).dispatch();
			}else{
				window.location.href = "/" + window.location.search;
			}
		}
		function logout(){
			auth.logout();
			dom.byId("username").value = "";
			goToLoginScreen(true);
		}

		var initialized = false;

		return {
			supportEmail: server.supportEmail,

			afterActivate: function(){
				// Don't initialize if the user is not logged-in
				if (!auth.hasLoggedIn()){
					goToLoginScreen();
					return;
				} 

				if (!initialized){
					var map = new Map("map", {
						fadeOnZoom: true,
						sliderPosition: "bottom-left",
						logo: project.config.map.esrilogovisible,
						showAttribution: project.config.map.attributionvisible,
						extent: project.config.map.getInitialExtent(),
						wrapAround180: project.config.map.wraparound180,
						lods: project.config.map.getLods(),
						slider: !has("touch"),

						showInfoWindowOnClick: true,
						infoWindow: popup.get()
					});

					map.standby = registry.byId("mapStandby");
					map.standby.show();

					var layers = mapLayers.getOperationalLayers({
						onError: function(err){
							if (err.error){
								if (err.error.message.indexOf("Unable to load image") === 0){
									domStyle.set("mapError", "display", "block");
								}else if (err.error.message.indexOf("You do not have access to this resource") !== -1){
									registry.byId("dlgAuthError").show();
									dom.byId("dlgAuthErrorMessage").innerHTML = err.error.message;
								}else{
									domStyle.set("mapError", "display", "block");
									map.standby.hide();

									topic.publish("map/layerLoadError", err.target);
								}
								console.warn(err);
							}
						}
					});

					map.on("load", function(){
						map.standby.hide();

						var geoLocate = new LocateButton({
							map: map,
							useTracking: true,
							centerAt: false,
							setScale: false,
							// clearOnTrackingStop: true,
							scale: map.getMaxZoom() * map.getMaxScale()
						}, "locateButton");
						geoLocate.startup();

						// Add spinner
						var spinner;
						var locating = true;
						var closedPopup = false;
						var hasCentered = false;
						var hideEvent = null;

						query("#locateButton .zoomLocateButton").on("click", function(){
							spinner = this;
							domAttr.set(spinner, "data-locating", locating ? "1" : "0"); // class is overriden by widget
							locating = !locating;
							closedPopup = false;
							hasCentered = false;
						});
						on(geoLocate, "locate", function(e){
							if (!e.error){
								domAttr.set(spinner, "data-locating", "0");

								if (e.position && !closedPopup){
									// Show on map
									var center = new Point(e.position.coords.longitude, e.position.coords.latitude);
									var content = infoTemplate.getFieldHtml("Latitude:", center.getLatitude()) +
												  infoTemplate.getFieldHtml("Longitude:", center.getLongitude());
									
									map.infoWindow.show(center, map.getInfoWindowAnchor(center), {hideZoom: true});
									map.infoWindow.clearFeatures();

									if (hideEvent) hideEvent.remove();
									hideEvent = map.infoWindow.on("hide", function(evt){
										closedPopup = true;
									});
									
									if (has("touch")){
										map.infoWindow.setTitle("<div class='latLonLabel'>Lat: " + center.getLatitude() + "<br/>Lon: " + center.getLongitude() + "</div>");
										map.infoWindow.setContent(content);
									}else{
										map.infoWindow.setTitle("");
										map.infoWindow.setContent(content);
									}

									// The first time a location is received
									// zoom and center to the location
									if (!hasCentered){
										map.centerAt(center);
										hasCentered = true;
									}
								}
							}else if (/denied/.test(e.error.message)){
								registry.byId("dlgGpsError").show();
							}
						});
						
						// Enable snapping when snapping layers are defined
						var snapLayers = array.filter(layers, function(layer){
								return layer.snapping;
							});
						if (snapLayers.length > 0){
							map.enableSnapping({
								tolerance: 20,
								layerInfos: array.map(snapLayers, function(layer){
										return {layer: layer};
									})
							});
						}
						
					});
					map.addLayers(layers);

					map.on("update-start", function(){
						domStyle.set("mapError", "display", "none");
					});
					topic.subscribe("connectionError", function(err){
						domStyle.set("mapError", "display", "block");
					});
									
					var sideMenu = new SideMenu({
						map: map,
						layers: layers,
						menuButton: "menuButton",
						menuCloseOverlay: "menuCloseOverlay",
						logout: logout
					}, "sideMenu");
					sideMenu.startup();

					// Fixes an issue on Android where the infowindows
					// are not opened on tap https://geonet.esri.com/thread/137176
					// Turn fastclicks only on iOS for now
					dom.byId("map").dojoClick = iOS;

					if (project.config.hasWidget.Search){
						var search = new Search({
							enableButtonMode: false, //this enables the search widget to display as a single button
							enableLabel: false,
							enableInfoWindow: true,
							showInfoWindowOnSelect: true,
							enableSourcesMenu: true,
							activeSourceIndex: "all",
							zoomScale: project.get("config.widgets.Search.primary.zoomscale", 1000),
							allPlaceholder: project.get("config.widgets.Search.primary.searchPlaceholder", "Search"),

							map: map,
							sources: mapSearch.getSources(),
						}, "search");
						on(search, "load", function(){
							dom.byId("search").dojoClick = true;
						});
						search.startup();
					}

					if (project.config.map.scalebarvisible){
						var scalebar = new Scalebar({
							map: map,
							scalebarUnit: "english"
						}); 

						// Add togglable 1:xxxx scale indicator
						// (not available in ESRI's scalebar)
						var toggleScalebarMode = function(){
							var ratioLabelHidden = domStyle.get(ratioLabel, "display") === "none";				
							for (var i = 0; i < scaleLabels.length; i++) domStyle.set(scaleLabels[i], "display", ratioLabelHidden ? "none" : "block");
							domStyle.set(ratioLabel, "display", ratioLabelHidden ? "block" : "none");	
						};

						var getMapScaleRatio = function(){
							return "1:" + utils.commafy(utils.round(map.getScale(), 0));
						};

						var scaleLabelsContainer = query(".scaleLabelDiv", scalebar.domNode)[0];
						var scaleLabels = scaleLabelsContainer.childNodes;
						var ratioLabel = domConstruct.toDom("<div class='esriScalebarLabel' style='display: none; width: 100%; text-align: center;'>" + getMapScaleRatio() + "</div>");
						domConstruct.place(ratioLabel, scaleLabelsContainer, "last");
						
						map.on("zoom", function(){
							ratioLabel.innerHTML = getMapScaleRatio();							
						});
						on(scalebar.domNode, "click", toggleScalebarMode);
					}

					// Make infoWindow movable on desktop
					if (!has("touch")){
						var infoWindowHandle = query(".title", map.infoWindow.domNode)[0];
						var infoWindowDnd = new Moveable(map.infoWindow.domNode, {
							handle: infoWindowHandle
						});
					}

					
					// Subscribe to authentication events
					topic.subscribe("authentication", function(message){
						if (message == "InvalidToken"){
							registry.byId("dlgTokenInvalid").show();
						}
					});
					on(dom.byId("btnOkDlgTokenInvalid"), "click", function(){
						registry.byId("dlgTokenInvalid").hide();
						goToLoginScreen();
					});

					new Toaster({id: 'mapToaster'}, dom.byId('ToasterPane'));
					topic.subscribe("map/showNotification", function(message, type){
						// Only show notifications when menu is closed
						if (!sideMenu.isOpen()){
							var toaster = registry.byId('mapToaster');

							var toasterType = "toasterTypeMessage";
							if (type == "error") toasterType = "toasterTypeError";

							toaster.positionDirection = 'br-up';
							toaster.slideDuration = 200;
							toaster.setContent("<div class='toasterMessageContainer " + toasterType + "'><div class='toasterIcon'></div><div class='toasterMessage'>" + message + "</div></div>", "message", 8000);
							toaster.show();
						}
					});

					initialized = true;
				}
			}
		};
});