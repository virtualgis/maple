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
define("maple/widgets/Routes", ["dojo/_base/declare", "dijit/_WidgetBase", 
		"dojo/text!maple/widgets/Routes/Routes.html",
		"dijit/_TemplatedMixin",
		"dojo/Evented","maple/config/project", "dojo/_base/array", "maple/helpers/ui",
		"esri/geometry/Extent", "esri/SpatialReference",
		"dojo/dom-construct",
		"dojo/on", "dojo/dom-class", "dojo/request", "dojo/Deferred",
		"maple/helpers/auth", "dojo/has", "maple/helpers/utils",
		"esri/geometry/Point", "maple/helpers/map/geometries",
		"dojo/topic", "dojo/_base/lang", "maple/helpers/map/infoTemplate",
		"maple/helpers/map/popup", "maple/helpers/widgets/common"],
function(declare, _WidgetBase, template,
		_TemplatedMixin, Evented, project, array, ui,
		Extent, SpatialReference,
		domConstruct,
		on, domClass, request, Deferred,
		auth, has, utils, Point, mapGeometries,
		topic, lang, infoTemplate, mapPopup, common){

	return declare("maple/widgets/Routes", [_WidgetBase, _TemplatedMixin], {
		templateString: template,

		constructor: function(params, srcNodeRef){
			this.inherited(arguments);
		},

		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

			this.pointLocationServiceUrl = this.serviceUrl + "/PointLocation";
			this.identifyRouteServiceUrl = this.serviceUrl + "/IdentifyRoute";

			this.searchPlaceholder = this.searchPlaceholder || "Search";
			this.popup = this.popup || {
				"displayLatLon": true,
          		"displayOriginalExtent": true,
          		"displayElevation": true
			};
			if (this.popup.elevationFieldLabel === undefined) this.popup.elevationFieldLabel = "Elevation (M)";
			this.zoomScale = this.zoomScale !== undefined ? this.zoomScale : 6000;
			this.tolerance = this.tolerance !== undefined ? this.tolerance : 0;

			if (this.instructionsText){
				this.instructions.innerHTML = this.instructionsText;
			}else{
				domClass.add(this.instructions, "hide");
			}

			var retrieveHints = function(text){
				// Validate input
				var unsafeText = text;
				text = self.purifyInputQuery(text);

				if (text !== ""){
					self.pointLocation(text).then(function(points){
						for (var i = 0; i < points.length; i++){
							self.searchBoxControl.addHint(utils.removeTags(unsafeText) + ' (' + (i + 1) + ')', points[i], unsafeText);
						}
						self.searchBoxControl.onHintsRetrieved(unsafeText);
					}, function(errMessage){
						self.searchBoxControl.showError(errMessage);
					});
				}
			};

			this.searchBoxControl = ui.setupSearchBox({
				searchgroup: this.searchgroup,
				clearSearchButton: this.clearSearchButton,
				searchbox: this.searchbox,
				searchButton: this.searchButton,
				hintsNode: this.hints,
				noResults: this.noResults,
				noResultsKeyword: this.noResultsKeyword,
				error: this.error,
				errorMessage: this.errorMessage,

				hints: retrieveHints,
				onSelectHint: function(point, label){
					self.zoomTo(point, label);
				}
			});

			topic.subscribe("map/removeClicks", lang.hitch(this, function(sender){
				if (sender !== this){
					this.disableMeasurement();
				}
			}));
		},

		pointLocation: function(measure){
			var done = new Deferred();
			var self = this;

			request.get(auth.tokenizedGetUrl(self.pointLocationServiceUrl, {
						routeIDFieldName: self.routeIdFieldName,
						routeID: self.routeId,
						measure: measure,
						f: "json"
					}),{
						handleAs: "json",
						// Avoid preflight request
						headers: {
							"X-Requested-With": null
						}
				}).then(function(json){
					if (json.geometries && json.geometries.points){
						var points = [];

						array.forEach(json.geometries.points, function(point){
							if ( (point.length === 3 && point[2] === parseFloat(measure)) || 
								 (point.length === 4 && point[3] === parseFloat(measure)) ){
								var obj = new Point({
									x: point[0],
									y: point[1],
									spatialReference: new SpatialReference(json.geometries.spatialReference)
								});

								// Do we have elevation?
								if (point.length === 4) obj.elevation = parseFloat(point[2]);

								points.push(obj);
							}
						});

						done.resolve(points);
					}else if (json.errorDescription){
						if (json.errorDescription === "LOCATING_E_CANT_FIND_LOCATION (5)"){
							done.resolve([]);
						}else{
							done.reject("Cannot search, please try again later (" + json.errorDescription + ")");
						}
					}else{
						if (json.error && json.error.code === 500){
							done.resolve([]);
						}else{
							done.reject("The server is not responding properly, please try again later.");
						}
					}
				}, function(err){
					done.reject("The server did not respond to our request, please try again later.");
				});

			return done;
		},

		purifyInputQuery: function(text){
			// Only numbers
			return text.replace(/[^\d]+/g, "");
		},

		startup: function(){
			this.inherited(arguments);

			this.emit("load", {});
		},

		measureButtonClicked: function(){
			domClass.toggle(this.measureButton, "active");

			if (domClass.contains(this.measureButton, "active")){
				this.enableMeasurement();
			}else{
				this.disableMeasurement();
				this.map.setInfoWindowOnClick(true);
			}
		},

		enableMeasurement: function(){
			var self = this;

			topic.publish("map/removeClicks", this);
			var map = this.map;
			map.setMapCursor("crosshair");
			map.setInfoWindowOnClick(false);

			this.onMapClickHandler = this.map.on("click", function(evt){

				var point = evt.mapPoint;
				
				var measurementFieldLabel = (self.popup && self.popup.measurementFieldLabel) ? self.popup.measurementFieldLabel : "Measurement";
				var measurementField = infoTemplate.getDynamicFieldHtml(measurementFieldLabel + ":", "<img class='spinner' src='/images/spinner.gif'/>");
				
				var displayElevation = self.popup && self.popup.displayElevation;
				var elevationField,
					elevationFieldLabel;

				if (displayElevation){
					elevationFieldLabel = (self.popup && self.popup.elevationFieldLabel) ? self.popup.elevationFieldLabel : "Elevation (M)";
					elevationField = infoTemplate.getDynamicFieldHtml(elevationFieldLabel + ":", "<img class='spinner' src='/images/spinner.gif'/>");
				}
				
				var content = self.getPopupContentForPoint(point);

				mapPopup.show({
					map: map,
					point: point,
					title: "",
					content: measurementField.getField() + 
							 content + 
							 (displayElevation ? elevationField.getField() : ""),

					mobileTitle: function(){
							return measurementField.getField(function(id, title, content){
								return "<span id='" + id + "'>" + content + "</div>";
							});
						},
					mobileContent: content,
					hideZoom: true
				});

				function showError(msg){
					measurementField.setContent(msg);
				}

				// Find measurement
				request.get(auth.tokenizedGetUrl(self.identifyRouteServiceUrl, {
							location: JSON.stringify(point.toJson()),
							tolerance: self.tolerance,
							routeIDFieldName: self.routeIdFieldName,
							f: "json"
						}),{
							handleAs: "json",
							// Avoid preflight request
							headers: {
								"X-Requested-With": null
							}
					}).then(function(json){
						if (json.location && Object.prototype.toString.apply(json.location) === "[object Array]"){
							var content = "";
							if (json.location.length > 0){
								content = array.map(json.location, function(location){
										return location.measure;
									}).join("<br/>");
							}else{
								content = "No value";
							}
							measurementField.setContent(content);

							// Request elevation if needed
							// (we need to do another roundtrip to the server)
							if (displayElevation){
								// Only works for single locations
								if (json.location.length === 1 && json.location[0].measure){
									self.pointLocation(json.location[0].measure).then(function(points){
										if (points.length === 1 && points[0].elevation){
											elevationField.setContent(points[0].elevation);
										}else{
											elevationField.setContent("No value");
										}
									}, function(errMessage){
										elevationField.setContent(errMessage);
									});
								}else{
									elevationField.setContent("No value");
								}
							}
						}else{
							showError("The server is not responding properly, please try again later.");
						}
					}, function(err){
						showError("The server did not respond to our request, please try again later.");
					});
			});
		},

		disableMeasurement: function(){
			if (this.onMapClickHandler){
				this.onMapClickHandler.remove();
				this.onMapClickHandler = null;

				domClass.remove(this.measureButton, "active");
			}
			this.map.setMapCursor("default");
		},

		getPopupContentForPoint: function(point){
			var content = "";
			if (this.popup){
				if (this.popup.displayLatLon){
					content += infoTemplate.getFieldHtml("Latitude:", point.getLatitude()) +
							  infoTemplate.getFieldHtml("Longitude:", point.getLongitude());
				}

				if (this.popup.displayElevation && point.elevation){
					content += infoTemplate.getFieldHtml(this.popup.elevationFieldLabel + ":", point.elevation);
				}

				if (this.popup.displayOriginalExtent){
					content += infoTemplate.getFieldHtml("X:", point.x);
					content += infoTemplate.getFieldHtml("Y:", point.y);
					content += infoTemplate.getFieldHtml("WKID:", point.spatialReference.wkid);
				}
			}
			return content;
		},

		zoomTo: function(point, label){
			var self = this;

			function doZoom(reprojectedPoint){
				common.zoomTo(reprojectedPoint, self.map, self.zoomScale, {
						title: label,
						getContent: function(point){
							return self.getPopupContentForPoint(point);
						},
					}, self.searchButton);
			}

			if (point.spatialReference.wkid === this.map.spatialReference.wkid){
				doZoom(reprojectedPoint);
			}else{
				self.searchBoxControl.showSpinner();

				// Need to reproject
				mapGeometries.reproject([point], this.map.spatialReference)
					.then(function(geometries){
						var reprojectedPoint = geometries[0];

						// Copy elevation
						if (point.elevation !== undefined) reprojectedPoint.elevation = point.elevation;

						doZoom(reprojectedPoint);
						self.searchBoxControl.hideSpinner();
					}, function(err){
						self.searchBoxControl.showError("Could not reproject geometries. Please try again later.");
					});
			}
		},

		// Called when widget is opened
		onShow: function(){
			if (!has("touch")){
				var self = this;

				setTimeout(function(){
					self.searchBoxControl.clearSearch();
					self.searchbox.focus();
				}, 500);
			}
		}
	});
});