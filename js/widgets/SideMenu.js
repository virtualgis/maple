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
define("maple/widgets/SideMenu", ["dojo/_base/declare", "dijit/_WidgetBase", 
		"dojo/text!maple/widgets/SideMenu.html",
		"dijit/_TemplatedMixin", "dijit/_WidgetsInTemplateMixin", 
		"dojo/query", "dojo/dom-class", "dojo/dom-attr", "dojo/on",
		"dojo/_base/array",
		"maple/helpers/utils", "maple/helpers/ui", "dojo/Evented",
		"maple/config/project",
		"maple/widgets/LayerControl", "esri/dijit/Legend", "esri/dijit/BasemapGallery",
		"maple/widgets/Query", "maple/widgets/Draw", "maple/widgets/Print", "esri/dijit/Measurement",
		"maple/widgets/Bookmarks", "maple/helpers/dragndrop",
		"maple/widgets/Edit", 
		"maple/widgets/Locate",
		"maple/widgets/Weather",
		"maple/widgets/Links",
		"maple/widgets/Routes",
		"dojo/dom-construct", "dojo/dom", "dojo/has",
		"maple/helpers/map/layers", "dijit/registry", "dojo/topic", "esri/units",
		"maple/widgets/AddDataLayers", "maple/widgets/ElevationProfile", "maple/widgets/eTime",
		"maple/helpers/login",
		"dojox/mobile/Button", "dojo/NodeList-traverse", "dojo/NodeList-dom", "dojox/mobile/Switch"],
function(declare, _WidgetBase, template, _TemplatedMixin, _WidgetsInTemplateMixin,
		query, domClass, domAttr, on, array, utils, ui, Evented, project,
		LayerControl, Legend, BasemapGallery, QueryWidget, DrawWidget, PrintWidget, Measurement,
		Bookmarks, dragndrop,
		Edit,
		Locate,
		Weather, Links, Routes,
		domConstruct, dom, has,
		mapLayers, registry, topic, Units,
		AddDataLayers, ElevationProfile, eTime,
		login
		){

	var iOS = utils.getPlatform() === "iOS";
	utils.preloadImages(["/images/lock-locked.svg"]);

	return declare("maple/widgets/SideMenu", [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
		templateString: template,
		widgetsInTemplate: true,

		buildRendering: function(){
			this.inherited(arguments);

			if (this.menuCloseOverlay) this.menuCloseOverlay = dom.byId(this.menuCloseOverlay);
		},

		open: function(){
			domClass.add(this.domNode, "open");

			if (this.queryWidget.areItemsChecked()){
				// Open the query widget automatically on desktop
				if (!has("touch")){
					this.queryWidget.search.open();
				}
			}

			if (has("touch")){
				this.setOverlayVisible(true);
			}
		},

		isOpen: function(){
			return domClass.contains(this.domNode, "open");
		},

		isLocked: function(){
			return domClass.contains(this.btnLockUnlockMenu.domNode, "locked");
		},

		close: function(){
			domClass.remove(this.domNode, "open");

			// Close the query widget automatically on desktop
			if (!has("touch")){
				this.queryWidget.search.close();
			}

			if (has("touch")){
				this.setOverlayVisible(false);
			}
		},

		// Used to place a full screen div to catch a touch close
		// event on mobile.
		setOverlayVisible: function(flag){
			if (this.menuCloseOverlay){
				this.menuCloseOverlay.style.display = flag ? 'block' : 'none';
			}
		},


		startup: function(){
			this.inherited(arguments);
			var self = this;

			// Initialize drag & drop
			var dndHandler = new dragndrop.Handler("map");

			// Load Control, but don't initialize it yet
			var layerControl = new LayerControl({
				map: self.map,
				separated: true,

				// We need to separate layers because 
				// "Prior to 4.0, they always had to be on top of non-graphics layers."
				// https://developers.arcgis.com/javascript/beta/guide/migrating/#mapandlayer
				// https://geonet.esri.com/thread/43863
				// "Graphics layers can be reordered within the group of graphics layers. However, the graphics layer in Map.Graphics is always on top."

				vectorReorder: true,
				overlayReorder: true
			}, "layerList");
			layerControl.startup();
			topic.subscribe("viewer/layerAdded", function(layer){
				layerControl.addLayer(mapLayers.layerToLayerInfo(layer));
			});
			topic.subscribe("viewer/closeMenu", function(){
				if (!self.isLocked() && self.isOpen()) self.close();
			});

			var getLayerInfo = function(layers){
				var orderMap = mapLayers.getOperationalLayersOrderMap();
				layers.sort(function(a, b){
					return orderMap[a.layer.id] < orderMap[b.layer.id] ? -1 : 1;
				});
				return array.map(layers, mapLayers.layerToLayerInfo);
			};

			function WidgetLoader(){
				this.widgetsToLoadOnEvent = [];
				this.receivedEvents = [];

				function WidgetContainer(methods){
					this.widget = null;
					for (var i in methods){
						this[i] = methods[i];
					}

					if (!this.container) throw new Error("Container missing for ", this);
				}
				WidgetContainer.prototype.getWidget = function(){
					return this.widget;
				};
				WidgetContainer.prototype.isOpen = function(){
					return domClass.contains(this.container, "open");
				};
				WidgetContainer.prototype.close = function(){
					domClass.remove(this.container, "open");
					widgetLoader.notify(this, "closed");
				};

				this.widgets = {
					'draw': new WidgetContainer({
						container: self.draw,
						initialize: function(done){
							var widget = new DrawWidget({
								map: self.map
							}, "draw");
							widget.startup();
							this.widget = widget;
							dom.byId("drawLoading").style.display = 'none';
							if (done !== undefined) done(widget);
						},
						showOnlyWhen: function(){
							return project.config.hasWidget.eDraw;
						}
					}),
					'measure': new WidgetContainer({
						container: self.measure,
						initialize: function(done){
							var widget = new Measurement({
								defaultAreaUnit: Units.ACRES,
								defaultLengthUnit: Units.FEET,
								map: self.map
							}, "measurement");
							widget.startup();
							this.widget = widget;

							var resetTool = function(){
								widget.setTool("area", false);
								widget.setTool("distance", false);
								widget.setTool("location", false);
								widget.clearResult();
								hideClearButton();
							};
							var showClearButton = function(){
								domClass.remove(self.clearMeasurementButton.domNode, "hide");
							};
							var hideClearButton = function(){
								domClass.add(self.clearMeasurementButton.domNode, "hide");
							};

							dom.byId("measurementLoading").style.display = 'none';
							on(widget, "tool-change", function(e){
								self.map.setInfoWindowOnClick(e.toolName === null);
								if (e.toolName !== null){
									topic.publish("map/removeClicks", this);
									self.map.setMapCursor("crosshair");
								}else{
									self.map.setMapCursor("default");
									hideClearButton();
								}
							});
							on(widget, "measure-start", showClearButton);
							on(widget, "measure-end", showClearButton);
							topic.subscribe("map/removeClicks", function(sender){
								if (sender !== widget){
									resetTool();
									hideClearButton();
								}
							});
							on(self.clearMeasurementButton, "click", function(){
								resetTool();
							});
							
							if (done !== undefined) done(widget);
						},
						showOnlyWhen: function(){
							return project.config.hasWidget.Measure;
						}
					}),
					'export': new WidgetContainer({
						container: self['export'],
						initialize: function(done){
							this.widget = new PrintWidget({
								map: self.map,
								exportDialog: registry.byId("dlgExportCompleted"),
								exportOpenFile: self.exportOpenFile
							}, "print");
							this.widget.startup();
							dom.byId("printLoading").style.display = 'none';
							if (done !== undefined) done(this.widget);
						},
						showOnlyWhen: function(){
							return project.config.hasWidget.Print; 
						}
					}),
					'layerList': new WidgetContainer({
						container: self.layerList,
						initialize: function(evt, done){
							this.widget = layerControl;

							var layerInfo = getLayerInfo(evt.layers);
							if (layerInfo.length > 0){
								var layerInfos = array.filter(layerInfo,
													function(layer){
														return layer.layer.opacity > 0;
													});
								on(layerControl, "load", function(){
									// Show list
									domClass.remove(dom.byId("layerList"), "hide");

									// Hide loader
									dom.byId("layerListLoading").style.display = 'none';
									
									if (done !== undefined) done(layerControl);
								});
								topic.subscribe("viewer/handleError", function(e){
									console.warn(e); // TODO
								});
								layerControl.initialize(layerInfos);

								// Bug with fastclick on Android
								// Turn fastclicks only on iOS for now
								dom.byId("layerList").dojoClick = iOS;
							}
						},
						initializeOn: 'layers-add-result',
						showOnlyWhen: function(){
							return project.config.hasWidget.LayerList;
						}
					}),
					'basemap': new WidgetContainer({
						container: self.basemap,
						initialize: function(evt, done){
							// The basemap widget
							// is always initialized on map
							// load, regardless of configuration
							this.widget = basemapGallery;
							if (done !== undefined) done(basemapGallery);
						},
						initializeOn: 'load',
						showOnlyWhen: function(){
							return project.config.hasWidget.eMapSwitcher;
						}
					}),
					'legend': new WidgetContainer({
						container: self.legend,
						initialize: function(evt, done){
							var layerInfo = getLayerInfo(evt.layers);
							
							// Add transparent layers compatible with legend widget
							var transparentLayerInfo = getLayerInfo(array.map(mapLayers.getTransparentLegendOpLayers(), function(layer){
																		return {layer: layer};
																	}));
							for (var i in transparentLayerInfo) layerInfo.push(transparentLayerInfo[i]);

							var showAll = registry.byId("legendShowAll");

							// Use first legend widget config and ignore others
							var legendConfig = project.config.widgetcontainer.findAllFlat("Legend")[0].config;
							showAll.set('value', legendConfig.respectcurrentmapscale ? "on" : "off");
							
							if (Object.prototype.toString.apply(legendConfig.excludelayer) === "[object Array]"){
								layerInfo = array.filter(layerInfo, function(layer){
												return array.indexOf(legendConfig.excludelayer, layer.title) === -1;
											});
							}

							// Legend
							var legend = new Legend({
							map: self.map,
								layerInfos: layerInfo,
								respectCurrentMapScale: showAll.value === "on"
							}, "legend");
							this.widget = legend;
							legend.startup();
							showAll.on("stateChanged", function(newValue){
								legend._respectCurrentMapScale = newValue === "on";
								legend.refresh();
							});

							// Hide legend loader also, since a load event is not raised
							// for it, we assume that if layers loaded, so did the legend
							dom.byId("legendLoading").style.display = 'none';
							if (done !== undefined) done(legend);
						},
						initializeOn: 'layers-add-result',
						showOnlyWhen: function(){
							return project.config.hasWidget.Legend;
						}
					}),
					'addDataLayers':new WidgetContainer({
						container: self.addDataLayers,
						initialize: function(done){
							this.widget = new AddDataLayers({
								map: self.map
							}, "addDataLayers");
							this.widget.startup();
							dom.byId("addDataLayersLoading").style.display = 'none';
							
							if (done !== undefined) done(this.widget);
						},
						showOnlyWhen: function(){
							return project.config.hasWidget.ImportDataFile;
						}
					}),
					'elevationProfile': (function(){
						var loaded = false;

						return new WidgetContainer({
							container: self.elevationProfile,
							initialize: function(done){
								this.widget = new ElevationProfile({
									map: self.map
								}, "elevationProfile");
								this.widget.on("load", function(){
									dom.byId("elevationProfileLoading").style.display = 'none';
									loaded = true;
								});
								this.widget.startup();
								if (done !== undefined) done(this.widget);
							},
							handleNotification: function(e){
								if (e === 'opened' && loaded){
									this.widget.resizeChart();
								}
							},
							showOnlyWhen: function(){
								return project.config.hasWidget.ElevationProfile;
							}
						});
					})(),
					'weather':new WidgetContainer({
						container: self.weather,
						initialize: function(done){
							this.widget = new Weather({
								map: self.map
							}, "weather");
							this.widget.startup();
							dom.byId("weatherLoading").style.display = 'none';
							if (done !== undefined) done(this.widget);
						},
						showOnlyWhen: function(){
							return project.config.hasWidget.WMSLooping;
						}
					}),
					'editWidget': new WidgetContainer({
						container: self.editWidget,
						initialize: function(done){
							this.widget = new Edit({
								map: self.map
							}, "editWidget");
							this.widget.startup();
							dom.byId("editWidgetLoading").style.display = 'none';
							if (done !== undefined) done(this.widget);
						},
						showOnlyWhen: function(){
							return project.config.hasWidget.Edit;
						}
					}),
					'eTime':(function(){
						var loaded = false;

						return new WidgetContainer({
							container: self.eTime,
							initialize: function(done){
								this.widget = new eTime({
									map: self.map
								}, "eTime");
								this.widget.startup();
								dom.byId("eTimeLoading").style.display = 'none';
								if (done !== undefined) done(widget);
								loaded = true;
							},
							showOnlyWhen: function(){
								return project.config.hasWidget.eTime;
							},
							handleNotification: function(e){
								if (loaded){
									if (e === 'closed') this.widget.onClose();
									else if (e === 'opened') this.widget.onOpen();
								}
							}
						});
					})(),
					'routes': (function(){
						var loaded = false;

						return new WidgetContainer({
							container: self.routes,
							setup: function(){
								var config = project.config.widgetcontainer.findFirst("Routes").config;
								if (config.menuLabel !== undefined){
									self.routesWidgetName.innerHTML = config.menuLabel;
								}
							},
							initialize: function(done){
								var config = project.config.widgetcontainer.findFirst("Routes").config;
								config.map = self.map;

								this.widget = new Routes(config, "routes");
								this.widget.startup();
								dom.byId("routesLoading").style.display = 'none';
								if (done !== undefined) done(this.widget);
								loaded = true;
							},
							showOnlyWhen: function(){
								return project.config.hasWidget.Routes;
							},
							handleNotification: function(e){
								if (e === 'opened' && loaded){
									this.widget.onShow();
								}
							}
						});
					})()
				};

				for (var k in this.widgets){
					if (this.widgets[k].showOnlyWhen && this.widgets[k].container && this.widgets[k].showOnlyWhen()){
						domClass.remove(this.widgets[k].container, "hide");
					}
					if (this.widgets[k].setup){
						if (!this.widgets[k].showOnlyWhen || this.widgets[k].showOnlyWhen()){
							this.widgets[k].setup();
						}
					}
				}
			}
			WidgetLoader.prototype.loadItem = function(item){
				var widgetId = domAttr.get(item, "data-widget");

				if (widgetId && this.widgets[widgetId] && !this.widgets[widgetId]._initialized){
					var widget = this.widgets[widgetId];
					this.load(widget);					
				}
			};
			WidgetLoader.prototype.load = function(widget, done){
				if (widget._initialized) {
					done(widget.getWidget());
					return;
				}

				// If the widget can be loaded only after a specific event,
				// Make sure that the event happened, otherwise add to queue
				if (widget.initializeOn){
					var evt = this.getEvent(widget.initializeOn);
					if (evt){
						this.initializeWidget(widget, evt.param, done);
					}else{
						this.widgetsToLoadOnEvent.push(widget);
					}
				}else{
					this.initializeWidget(widget, undefined, done);
				}
			};
			WidgetLoader.prototype.open = function(widget, done){
				if (widget.container){
					if (!widget.isOpen()){
						widget.container.click();
						domClass.add(widget.container, "open");
						this.load(widget, done);
						this.notify(widget, "opened");
					}else{
						this.load(widget, done);
					}
				}
			};
			WidgetLoader.prototype.notifyItem = function(item, e){
				var widgetId = domAttr.get(item, "data-widget");

				if (widgetId && this.widgets[widgetId] && this.widgets[widgetId].handleNotification){
					this.widgets[widgetId].handleNotification(e);
				}
			};
			WidgetLoader.prototype.notify = function(widget, e){
				if (widget.handleNotification) widget.handleNotification(e);
			};
			WidgetLoader.prototype.closeAll = function(){
				for (var i in this.widgets){
					if (this.widgets[i].isOpen()) this.widgets[i].close();
				}
			};
			WidgetLoader.prototype.getWidget = function(id){
				return this.widgets[id];
			};
			WidgetLoader.prototype.initializeWidget = function(widget, param, done){
				if (!widget._initialized){
					if (param !== undefined) widget.initialize(param, done);
					else widget.initialize(done);
					widget._initialized = true;
				}
			};
			WidgetLoader.prototype.handleEvent = function(evtName, param){
				this.receivedEvents.push({name: evtName, param: param});
				for (var i = 0; i < this.widgetsToLoadOnEvent.length; i++){
					var widgetToLoad = this.widgetsToLoadOnEvent[i];

					if (widgetToLoad.initializeOn === evtName && !widgetToLoad._initialized){
						this.initializeWidget(widgetToLoad, param);
					}
				}

				// Remove widgets from queue
				this.widgetsToLoadOnEvent = array.filter(this.widgetsToLoadOnEvent, function(w){
												return w.initializeOn !== evtName;
											});
			};
			WidgetLoader.prototype.getEvent = function(evtName){
				for (var i = 0; i < this.receivedEvents.length; i++){
					if (this.receivedEvents[i].name === evtName) return this.receivedEvents[i];
				}
				return null;
			};
			var widgetLoader = new WidgetLoader();

			// wait for all layers to be added
			var handleLayersAddResult = function (evt){
				// save reference to map in each layer (used by some widgets)
				array.forEach(evt.layers, function(layer){
					layer.layer._mapRef = self.map;
				});

				widgetLoader.handleEvent("layers-add-result", evt);

				layerAddResultListener.remove();
				layerLoadErrorListener.remove();
			};

			// This will get only raised if there are NO load errors
			// (on some layer types only, it's quite unpredictable) :/
			this.map.on("layers-add-result", function(evt){
				// Filter out layers that have failed
				var loadedLayers = array.filter(evt.layers, function(layer){
					return layer.success;
				});
				handleLayersAddResult({layers: loadedLayers});
			});

			// To overcome the limitations of "layers-add-result", we
			// receive notifications on failed load layers
			// and on successful load layers
			// Then, if needed, we raise an equivalent of "layers-add-result"
			// for continuing initialization. 
			var loadedLayersList = [];
			var layerAddResultListener = this.map.on("layer-add-result", function(evt){
				// Skip layers that failed to load
				if (evt.layer.loadError){
					console.warn("Failed to load: ", evt.layer.url);
					return;
				}
				
				// Skip basemaps
				if (!evt.layer._basemapGalleryLayerType){
					loadedLayersList.push({layer: evt.layer});
				}
			});
			var layerLoadErrorListener = topic.subscribe("map/layerLoadError", function(layer){
				if (self._layerLoadErrorTimeout) clearTimeout(self._layerLoadErrorTimeout);

				self._layerLoadErrorTimeout = setTimeout(function(){
					// Since we received an error, "layers-add-result" will
					// never get triggered. We wait for a few seconds
					// and then trigger the call ourselves.
					handleLayersAddResult({layers: loadedLayersList});
				}, 8000);
			});

			// Load basemap widget on map load
			var basemapGallery;

			this.map.on("load", function(evt){
				var basemapsLayers = mapLayers.getBasemapLayers();

				if (basemapsLayers.length > 0){
					// The basemapgallery removes the first operationallayer
					// unless basemapIds are specified, in which case
					// you need to add a layer to the map with that id
					// See https://os.masseranolabs.com//dashboard#details/e08a5bcde9df95e0c46fe7ec11a899c9
					basemapsLayers[0].id = "basemap_99999"; // _99999 guarantees this is the first basemap to be chosen when sorting
					self.map.addLayer(basemapsLayers[0]);

					basemapGallery = new BasemapGallery({
						basemapIds: ["basemap_99999"],
						showArcGISBasemaps: project.get("config.map.addarcgisbasemaps", true),
						basemaps: basemapsLayers,
						bingMapsKey: project.get("config.bing.key", ""),
						map: self.map
					}, "basemapGallery");

					basemapGallery.startup();

					dom.byId("basemapsLoading").style.display = 'none';
					basemapGallery.basemaps.sort(function(a, b){ return a.id > b.id ? -1 : 1; });

					// Select first
					if (basemapGallery.basemaps.length > 0){
						basemapGallery.select(basemapGallery.basemaps[0].id);
					}
				}

				// Pass the map load event to widgets that care
				widgetLoader.handleEvent("load", evt);
			});

			this.queryWidget = new QueryWidget({
				searchQuery: "searchQuery", // Container where to populate the search feature
				map: this.map,
				sideMenu: this
			}, "queryWidget");
			this.queryWidget.startup();

			this.bookmarksWidget = new Bookmarks({
				map: this.map
			}, "bookmarksWidget");
			this.bookmarksWidget.startup();

			this.locateWidget = new Locate({
				map: this.map
			}, "locateWidget");
			this.locateWidget.startup();

			this.linksWidget = new Links({
			}, "linksWidget");
			this.linksWidget.startup();

			// Menu
			var menuBtn = dom.byId(this.menuButton);
			on(menuBtn, "click", function(event){
				event.stopPropagation();

				self.open();
			});

			// Handle open/close
			// Open accordion when a user pressed an icon

			// Desktop
			if (!has("touch")){
				on(this.domNode, "click", function(){
					self.open();
				});
				on(dom.byId("btnCloseSideMenu"), "click", function(event){
					event.stopPropagation();

					// Close menus
					widgetLoader.closeAll();
					query("#accordion .item").removeClass("open");

					self.close();
				});

			// Mobile
			}else{
				on(this.domNode, "click", function(event){
					event.stopPropagation();
				});

				var checkClose = function(event){
					if (domClass.contains(self.domNode, "open") && !self.isLocked()){
						self.close();
						event.stopPropagation();
					}
				};

				if (this.menuCloseOverlay) on(this.menuCloseOverlay, "click", checkClose);
				on(window, "click", function(e){
					// If the user clicks a modal dialog, do not close the menu
					if (!domClass.contains(e.target, "mblSimpleDialogTitle") &&
						!domClass.contains(e.target, "mblSimpleDialog") &&
						!domClass.contains(e.target, "mblSimpleDialogCover") &&
						!domClass.contains(e.target, "mblSimpleDialogContainer") &&
						!domClass.contains(e.target, "mblSimpleDialogButton")){
						checkClose(e);
					}
				});
			}

			// Accordion
			query("#accordion > .item > .title").on("click", function(e){
				var item = query(e.target).closest(".item")[0];
				if (item){
					widgetLoader.loadItem(item);

					if (domClass.contains(item, "item")){
						domClass.toggle(item, "open");

						if (domClass.contains(item, "open")){
							widgetLoader.notifyItem(item, "opened");
						}else{
							widgetLoader.notifyItem(item, "closed");
						}
					}
				}
			});

			// Logout
			on(dom.byId("btnLogoutDlgConfirmLogout"), "click", this.logout);
			on(dom.byId("btnLogoutDlgAuthError"), "click", this.logout);

			if (project.config.server.authentication === "public"){
				domClass.add(this.btnLogout.domNode, "hide");
			}

			// Lock menu
			on(this.btnLockUnlockMenu.domNode, "click", function(){
				domClass.toggle(this, "locked");

				self.setOverlayVisible(!self.isLocked());
			});

			// Switch roles
			this.switchProfileSelector = ui.buildRoleSelector({
				id: 'switchProfileSelector',
				container: 'dlgSwitchProfileSelector'
			});
			on(dom.byId("switchProfileSelector"), "click", function(e){
				e.stopPropagation();
			});
			if (!project.config.profiles.multiple){
				domClass.add(this.btnSwitchRole.domNode, "hide");
			}

			// Drag N drop
			if (project.config.hasWidget.ImportDataFile){
				dndHandler.addListener(["zip"], "Add Shape File", function(files){
							var widget = widgetLoader.getWidget("addDataLayers");
							widgetLoader.load(widget, function(addDataLayer){
								addDataLayer.processOnDrop(files);
							});
						});
				dndHandler.addListener(["csv"], "Add Points File", function(files){
							var widget = widgetLoader.getWidget("addDataLayers");
							widgetLoader.load(widget, function(addDataLayer){
								addDataLayer.processOnDrop(files);
							});
						});
				dndHandler.addListener(["kml", "kmz"], "Add Google Earth File", function(files){
							var widget = widgetLoader.getWidget("addDataLayers");
							widgetLoader.load(widget, function(addDataLayer){
								addDataLayer.processOnDrop(files);
							});
						});
				dndHandler.addListener(["json"], "Add GeoJSON File", function(files){
							var widget = widgetLoader.getWidget("addDataLayers");
							widgetLoader.load(widget, function(addDataLayer){
								addDataLayer.processOnDrop(files);
							});
						});
				dndHandler.addListener(["ejsn"], "Add Drawing", function(files){
							var widget = widgetLoader.getWidget("draw");
							widgetLoader.load(widget, function(draw){
								draw.processOnDrop(files);
							});
						});
			}

			this.emit("load", {});
		},

		confirmLogout: function(){
			registry.byId("dlgConfirmLogout").show();
		},

		switchRole: function(e){
			e.stopPropagation();
			if (project.config.loadedConfiguration !== this.switchProfileSelector.value){
				this.close();
				dlgSwitchProfile.hide();
				
				var standBy = registry.byId("mapStandby");
				standBy.show();

				// Reload project with new configuration
				login.reloadNewConfiguration(this.switchProfileSelector.value);
			}else{
				dlgSwitchProfile.hide();
			}
		}
	});
});