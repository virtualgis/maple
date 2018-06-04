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
	 "dojo/_base/declare", "dijit/_WidgetBase", "dijit/_TemplatedMixin", "dijit/_WidgetsInTemplateMixin",
	 "dojo/_base/lang", "dojo/_base/Color", "esri/toolbars/draw",
	 "esri/layers/GraphicsLayer", "esri/graphic",
	 "dojo/text!./Draw.html", "esri/renderers/UniqueValueRenderer",
	 "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol",
	 "esri/symbols/SimpleFillSymbol", "esri/layers/FeatureLayer",
	 "esri/symbols/Font", "esri/symbols/TextSymbol", "esri/geometry/Point",
	 "dojo/dom", "dojo/on", "dojo/_base/array", "dojo/dom-class", "dojo/query", "dojo/topic", 
	 "maple/helpers/utils",
	 "maple/helpers/widgets/common",
	 "dijit/registry", "esri/geometry/geodesicUtils", "esri/units", "esri/geometry/webMercatorUtils",
	 "esri/geometry/Polyline",
	 "esri/toolbars/edit",
	 "esri/SpatialReference",
	 "maple/external/FileSaver",
     "terraformer",
     "terraformerArcgisParser",
	 "dojo/NodeList-dom",
	 "dojox/mobile/Button",
	 "dojox/mobile/Switch",
	 "maple/widgets/Slider"
], function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, 
	lang, Color, Draw, 
	GraphicsLayer, Graphic, template, UniqueValueRenderer, 
	SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, FeatureLayer,
	Font, TextSymbol, Point,
	dom, on, array, domClass, query, topic, utils, common, registry, 
	geodesicUtils, Units, webMercatorUtils, Polyline, Edit, SpatialReference, saveAs,
	Terraformer) {

	Draw.TEXT = "text"; // Missing
	Draw.GPS_LOCATION = "gps_location";

	return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
		widgetsInTemplate: true,
		templateString: template,

		drawTool: null,
		_textDrawing: false, // keep track if the text tool is selected
		_gpsDrawing: false, // same for GPS location tool
		editTool: null,

		buildRendering: function () {
			var self = this;

			this.inherited(arguments);
			this.drawTool = new Draw(this.map);
			this.drawTool.on('draw-end', lang.hitch(this, 'onDrawToolDrawEnd'));
			this.editTool = new Edit(this.map);
			this.editTool.on('deactivate', lang.hitch(this, 'onEditToolDeactivate'));
			this.editTool.on('graphic-move-stop', lang.hitch(this, 'onEditToolInteractionEnded'));
			this.editTool.on('rotate-stop', lang.hitch(this, 'onEditToolInteractionEnded'));
			this.editTool.on('scale-stop', lang.hitch(this, 'onEditToolInteractionEnded'));
			this.editTool.on('vertex-move-stop', lang.hitch(this, 'onEditToolInteractionEnded'));
			this.editTool.on('vertex-delete', lang.hitch(this, 'onEditToolInteractionEnded'));
			this.editTool.on('vertex-add', lang.hitch(this, 'onEditToolInteractionEnded'));
			
			this.createGraphics();

			topic.subscribe("map/removeClicks", lang.hitch(this, function(sender){
				if (sender !== this){
					this.unselectAllDrawTools();
					this.drawTool.finishDrawing();
				}
			}));


			this.pointStyle = common.createDropDown(this.pointStyleDropDownButton, common.pointStyles, function(label, value){
					self.pointSymbol.setStyle(value);
				});

			this.lineStyle = common.createDropDown(this.lineStyleDropDownButton, common.outlineStyles, function(label, value){
					self.polylineSymbol.setStyle(value);
					self.polygonSymbol.outline.setStyle(value);
				});
			this.shapeStyle = common.createDropDown(this.shapeStyleDropDownButton, common.fillStyles, function(label, value){
					self.polygonSymbol.setStyle(value);
				});
			this.textFont = common.createDropDown(this.textFontDropDownButton, [
					{label: "Arial", value: null},
					{label: "Georgia", value: null},
					{label: "Helvetica", value: null},
					{label: "Impact", value: null},
					{label: "Palatino", value: null},
					{label: "Tahoma", value: null},
					{label: "Times New Roman", value: null},
					{label: "Verdana", value: null}

				], function(label, value){
					self.textSymbol.font.setFamily(label);
				});

			this.distanceUnit = common.createDropDown(this.distanceUnitDropDownButton, [
					{label: "Feet", value: {unit: Units.FEET, abbr: "ft"}},
					{label: "Miles", value: {unit: Units.MILES, abbr: "mi"}},
					{label: "Meters", value: {unit: Units.METERS, abbr: "m"}},
					{label: "Yards", value: {unit: Units.YARDS, abbr: "yd"}}
				]);

			this.areaUnit = common.createDropDown(this.areaUnitDropDownButton, [
					{label: "Acres", value: {unit: Units.ACRES, abbr: "ac"}},
					{label: "Square miles", value: {unit: Units.SQUARE_MILES, abbr: "sq mi"}},
					{label: "Square feet", value: {unit: Units.SQUARE_FEET, abbr: "sq ft"}},
					{label: "Square yards", value: {unit: Units.SQUARE_YARDS, abbr: "sq yd"}},
					{label: "Hectares", value: {unit: Units.HECTARES, abbr: "ha"}}
				]);

			// Handle changes to options
			on(this.width, "change", function(){
				var value = self.width.value;
				self.pointSymbol.outline.setWidth(value);
				self.polylineSymbol.setWidth(value);
				self.polygonSymbol.outline.setWidth(value);
			});
			on(this.angle, "change", function(){
				self.pointSymbol.setAngle(self.angle.value);
				self.textSymbol.setAngle(self.angle.value);
			});
			on(this.size, "change", function(){
				self.pointSymbol.setSize(self.size.value);
			});
			on(this.fontSize, "change", function(){
				self.textSymbol.font.setSize(self.fontSize.value + "px");
			});
			on(this.text, "keyup", function(){
				self.textSymbol.setText(self.text.value);
			});

			registry.byId("drawShowMeasurementsOption").on("stateChanged", function(newValue){
				if (newValue === "on"){
					domClass.add(self.drawOptions, "showMeasurements");
				}else{
					domClass.remove(self.drawOptions, "showMeasurements");
				}
			});

			this.loadFromFileButton.domNode.style.display = 'inline';

			on(this.loadFileInput, "change", function(e){
				self.loadFromFile(e);
			});
			this.loadFileInput.dojoClick = false;

			on(this.domNode, "click", function(){ self.hideLoadFileError(); });
		},

		areMeasurementsEnabled: function(){
			return registry.byId("drawShowMeasurementsOption").get('value') === 'on' ||
					this._gpsDrawing === true; // Always measure with the gps tool
		},

		postCreate: function(){
			this.inherited(arguments);
			var self = this;

			// Creation of color pickers will be delayed
			// as not to freeze the UI
			var createColorPicker = common.colorPickerCreator();

			createColorPicker(this.markerColor, function(color){
				self.pointSymbol.setColor(color);
			});
			createColorPicker(this.outlineColor, function(color){
				self.pointSymbol.outline.setColor(color);
				self.polygonSymbol.outline.setColor(color);
			});
			createColorPicker(this.lineColor, function(color){
				self.polylineSymbol.setColor(color);
			});
			createColorPicker(this.fillColor, function(color){
				self.polygonSymbol.setColor(color);
			});
			createColorPicker(this.fontColor, function(color){
				self.textSymbol.setColor(color);
			});

			this.originalGpsStatus = this.gpsStatus.innerHTML;
		},
		createGraphics: function () {
			this.graphicLayers = [];

			// Remember to make clones of all of these prior to rendering
			// (via toJson)
			// See https://os.masseranolabs.com//dashboard#details/7ba6f58784c87441131aac4b28ec02a3
			this.pointSymbol = new SimpleMarkerSymbol(
									SimpleMarkerSymbol.STYLE_CIRCLE, 
									parseInt(this.size.value), 
									new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, 
															new Color(this.outlineColor.value), 
															parseInt(this.width.value)),
									new Color(this.markerColor.value));
			this.pointSymbol.color.a = 0.5; // ESRI Color constructor does not support alpha from hex conversion

			this.polylineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, 
													new Color(this.lineColor.value), 
													parseInt(this.width.value));

			this.polygonSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, 
													new SimpleLineSymbol(
															SimpleLineSymbol.STYLE_SOLID, 
															new Color(this.outlineColor.value), 
															parseInt(this.width.value)
														),
													new Color(this.fillColor.value));
			this.polygonSymbol.color.a = 0.5; // ESRI Color constructor does not support alpha from hex conversion

			this.textSymbol = new TextSymbol("", 
				new Font(this.fontSize.value + "px", Font.STYLE_NORMAL, Font.VARIANT_NORMAL, Font.WEIGHT_NORMAL, "Arial"));
			this.textSymbol.setColor(new Color(this.fontColor.value));
			this.textSymbol.setSize(this.fontSize.value);
			this.textSymbol.font.setFamily("Arial");
		},

		getGeometryForCurrentLocation: function(success, fail){
			var self = this;

			function locationError(error){
				var reason = "Unknown reason, please try again later.";

				switch (error.code) {
		            case error.PERMISSION_DENIED:
		              reason = "You need to give permission to access your location.";
		              break;
		            case error.POSITION_UNAVAILABLE:
		              reason = "Current location is not available.";
		              break;
		            case error.TIMEOUT:
		              reason = "The request timed out, please try again later.";
		              break;
	          	}

	          	fail("Could not find GPS location: " + reason);
			}

			if (navigator.geolocation) {  
	            navigator.geolocation.getCurrentPosition(function(location){
	            	var xy = webMercatorUtils.lngLatToXY(location.coords.longitude, location.coords.latitude);
	            	success(new Point(xy[0], 
        							xy[1], 
            						new SpatialReference({wkid: self.map.extent.spatialReference.wkid})
            					));
	            }, locationError);
			}else{
	            fail("Your browser doesn't support Geolocation. Please use a newer one.");
			}
		},

		addPointGraphic: function(graphic){
			var self = this;

			var layer = this.addSimpleGraphic('drawGraphics_point', graphic);
			
			if (!this._textDrawing){
				graphic.setSymbol(new SimpleMarkerSymbol(self.pointSymbol.toJson()));
			}
			
			if (this.areMeasurementsEnabled() && !this._textDrawing){
				var textGraphic = new Graphic(graphic.geometry, new TextSymbol(this.textSymbol.toJson()));
				layer.add(textGraphic);

				layer.updateMeasurements = function(){
					textGraphic.symbol.setText(graphic.geometry.getLongitude() + ", " + graphic.geometry.getLatitude());
					textGraphic.setGeometry(graphic.geometry);
				};
				layer.updateMeasurements();
			}
		},

		addPolylineGraphic: function(graphic){
			var self = this;

			graphic.setSymbol(new SimpleLineSymbol(self.polylineSymbol.toJson()));
			var layer = this.addSimpleGraphic('drawGraphics_line', graphic);

			if (this.areMeasurementsEnabled()){
				var textGraphic = new Graphic(graphic.geometry.getExtent().getCenter(), new TextSymbol(this.textSymbol.toJson()));
				layer.add(textGraphic);
				layer.updateMeasurements = function(){
					var geographicGeometry = webMercatorUtils.webMercatorToGeographic(graphic.geometry);
					var lengths = geodesicUtils.geodesicLengths(
									[geographicGeometry], 
									self.distanceUnit.value.unit);
					var text = utils.round(lengths[0], 2) + " " + self.distanceUnit.value.abbr;
					textGraphic.symbol.setText(text);
					textGraphic.setGeometry(graphic.geometry.getExtent().getCenter());
				};
				layer.updateMeasurements();
			}
		},

		addSimpleGraphic: function(id_prefix, graphic){
			var layer = new GraphicsLayer({
				id: id_prefix + '_' + this.graphicLayers.length,
				title: 'Draw Graphics'
			});

			this.map.addLayer(layer);
			this.graphicLayers.push(layer);
			this.createEditTool(layer);
			layer.add(graphic);

			return layer;
		},

		addPolygonGraphic: function(graphic){
			var layer = new FeatureLayer({
				layerDefinition: {
					geometryType: 'esriGeometryPolygon',
					fields: [{
						name: 'OBJECTID',
						type: 'esriFieldTypeOID',
						alias: 'OBJECTID',
						domain: null,
						editable: false,
						nullable: false
					}, {
						name: 'ren',
						type: 'esriFieldTypeInteger',
						alias: 'ren',
						domain: null,
						editable: true,
						nullable: false
					}]
				},
				featureSet: null
			}, {
				id: 'drawGraphics_poly_' + this.graphicLayers.length,
				title: 'Draw Graphics',
				mode: FeatureLayer.MODE_SNAPSHOT
			});
			var renderer = new UniqueValueRenderer(new SimpleFillSymbol(), 'ren', null, null, ', ');
			renderer.addValue({
				value: 1,
				symbol: new SimpleFillSymbol(this.polygonSymbol.toJson()),
				label: 'User Drawn Polygons',
				description: 'User Drawn Polygons'
			});
			
			layer.setRenderer(renderer);
			this.map.addLayer(layer);
			this.graphicLayers.push(layer);
			this.createEditTool(layer);
			layer.add(graphic);

			if (this.areMeasurementsEnabled()){
				var self = this;
				var textGraphic = new Graphic(graphic.geometry.getExtent().getCenter(), new TextSymbol(this.textSymbol.toJson()));
				
				// Measurement text needs to be added on a separate
				// layer, otherwise it will have problems being imported back
				// (this is a problem with ESRI's code, see https://os.masseranolabs.com//dashboard#details/93d85d5f300cada6aefbe0e894e29ff6)
				layer._linkedLayer = this.addSimpleGraphic('drawGraphics_text', textGraphic);

				layer.updateMeasurements = function(){
					var geographicGeometry = webMercatorUtils.webMercatorToGeographic(graphic.geometry);
					var areas = geodesicUtils.geodesicAreas(
									[geographicGeometry], 
									self.areaUnit.value.unit);
					var text = "Area: " + utils.round(areas[0], 2) + " " + self.areaUnit.value.abbr;

					// Sum all the parts of the polygon
					if (geographicGeometry.rings && geographicGeometry.rings.length === 1){
						var pline = new Polyline(geographicGeometry.rings[0]);
						var lengths = geodesicUtils.geodesicLengths(
											[pline], 
											self.distanceUnit.value.unit);

						text += " Perimeter: " + utils.round(lengths[0], 2) + " " + self.distanceUnit.value.abbr;
					}

					textGraphic.symbol.setText(text);
					textGraphic.setGeometry(graphic.geometry.getExtent().getCenter());
				};
				layer.updateMeasurements();
			}

			return layer;
		},

		unselectAllDrawTools: function(){
			query("#draw a.button").removeClass("selected");
		},

		hideAllOptions: function(){
			var self = this;
			array.forEach(["point", "line", "shape", "text", "gps"], function(item){
				domClass.remove(self.drawOptions, item);
			});
		},

		showOptionsFor: function(tool){
			this.hideAllOptions();
			domClass.add(this.drawOptions, this.getToolCategory(tool));
		},

		getToolCategory: function(tool){
			switch(tool){
				case Draw.POINT:
					return "point";
				case Draw.POLYLINE:
				case Draw.FREEHAND_POLYLINE:
					return "line";
				case Draw.RECTANGLE:
				case Draw.CIRCLE:
				case Draw.ELLIPSE:
				case Draw.POLYGON:
				case Draw.FREEHAND_POLYGON:
					return "shape";
				case Draw.TEXT:
					return "text";
				case Draw.GPS_LOCATION:
					return "gps";
				default:
					// Should never happen
					throw new Error("getToolCategory does not know how to handle " + tool);
			}	
		},

		setDrawTool: function(e, tool){
			topic.publish("map/removeClicks", this);
			this.unselectAllDrawTools();

			if (tool !== this._lastDrawTool){
				domClass.add(e.target, "selected");
				this.showOptionsFor(tool);
				this._lastDrawTool = tool;

				this.setMapInfoWindowOnClick(false);

				// We actually use POINT if the tool is TEXT
				// (Draw.TEXT is defined by us, there's no support for it out of the box)
				this._textDrawing = tool === Draw.TEXT;
				if (tool === Draw.TEXT) tool = Draw.POINT;

				// We use POINT if the tool is GPS_LOCATION
				this._gpsDrawing = tool === Draw.GPS_LOCATION;
				if (tool === Draw.GPS_LOCATION) tool = Draw.POINT;

				this.drawTool.activate(tool);
			}else{
				// User selected a tool, then pressed the tool again
				// before drawing == unselect
				this.stopDrawing();
			}	
		},
		
		setDrawPoint: function(e){ this.setDrawTool(e, Draw.POINT); },
		setDrawLine: function(e){ this.setDrawTool(e, Draw.POLYLINE); },
		setDrawFreeLine: function(e){ this.setDrawTool(e, Draw.FREEHAND_POLYLINE); },
		setDrawRectangle: function(e){ this.setDrawTool(e, Draw.RECTANGLE); },
		setDrawCircle: function(e){ this.setDrawTool(e, Draw.CIRCLE); },
		setDrawEllipse: function(e){ this.setDrawTool(e, Draw.ELLIPSE); },
		setDrawPolygon: function(e){ this.setDrawTool(e, Draw.POLYGON); },
		setDrawFreePolygon: function(e){ this.setDrawTool(e, Draw.FREEHAND_POLYGON); },
		setDrawText: function(e){ 
			this.textSymbol.setText(this.text.value);
			this.setDrawTool(e, Draw.TEXT);
		},
		setDrawGPSLocation: function(e){ 
			// Clear previous error messages
			this.gpsStatus.innerHTML = this.originalGpsStatus;
			this.setDrawTool(e, Draw.GPS_LOCATION); 
		},

		clearDrawing: function(){
			this.endDrawing();
			this.unselectAllDrawTools();
			this.setMapInfoWindowOnClick(true);
			this.hideGraphicsActionButtons();
		},

		setMapInfoWindowOnClick: function (flag) {
			this.map.setInfoWindowOnClick(flag);
		},

		showGraphicsActionButtons: function(){
			this.clearDrawingButton.domNode.style.display = 'inline';

			if (window.FileReader !== undefined){
				this.saveToFileButton.domNode.style.display = 'inline';
				this.exportButtons.style.display = 'inline';
				this.exportToGeoJsonButton.domNode.style.display = 'inline';
			}
		},

		hideGraphicsActionButtons: function(){
			this.clearDrawingButton.domNode.style.display = 'none';
			this.saveToFileButton.domNode.style.display = 'none';
			this.exportButtons.style.display = 'none';
			this.exportToGeoJsonButton.domNode.style.display = 'none';
		},

		onDrawToolDrawEnd: function (evt) {
			var self = this;
			this.showGraphicsActionButtons();
			this.unselectAllDrawTools();
			
			var graphic;
			if (evt.geometry.type === 'point'){
				if (this._textDrawing){
					graphic = new Graphic(evt.geometry, new TextSymbol(this.textSymbol.toJson()));
					this.addPointGraphic(graphic);
					this._textDrawing = false;
				}else if (this._gpsDrawing){
					// Async
					this.gpsStatus.innerHTML = "<img src='/images/spinner.gif' /> <div class='statusText'>Retrieving GPS location...</div>";

					this.getGeometryForCurrentLocation(function(geometry){
						graphic = new Graphic(geometry);
						self.addPointGraphic(graphic);
						self._gpsDrawing = false;
						self.map.centerAndZoom(geometry, 12);
						self.gpsStatus.innerHTML = self.originalGpsStatus;
					}, function(err){
						self.gpsStatus.innerHTML = "<img src='/images/warning.svg' /> <div class='statusText'>" + err + "</div>";
						self._gpsDrawing = false;
					});
				}else{
					graphic = new Graphic(evt.geometry);
					this.addPointGraphic(graphic);
				}
			}else if (evt.geometry.type === 'polyline'){
				graphic = new Graphic(evt.geometry);
				this.addPolylineGraphic(graphic);
			}else if (evt.geometry.type === 'polygon'){
				graphic = new Graphic(evt.geometry, null, {
					ren: 1
				});
				this.addPolygonGraphic(graphic);
			}
			this.stopDrawing();
		},

		stopDrawing: function () {
			this.drawTool.deactivate();
			this.setMapInfoWindowOnClick(true);
			this._lastDrawTool = null;
		},

		endDrawing: function () {
			var self = this;
			array.forEach(this.graphicLayers, function(layer){
				layer.clear();
				self.map.removeLayer(layer);
			});
			this.graphicLayers = [];

			this.drawTool.deactivate();
			this._lastDrawTool = null;
		},

		saveToFile: function(){
			var layerData = [];

			array.forEach(this.graphicLayers, function(layer){
				if (layer.toJson){
					layerData.push({type: 'feature', data: layer.toJson()});
				}else if (layer.graphics){
					var graphics = [];
					array.forEach(layer.graphics, function(graphic){
						if (graphic.toJson){
							graphics.push(graphic.toJson());
						}
					});
					layerData.push({type: 'graphics', data: graphics});
				}
			});

			var blob = new Blob([JSON.stringify(layerData)], {type: "text/plain;charset=utf-8"});
			saveAs(blob, "drawings.ejsn");
		},

		loadFiles: function(files){
			var self = this;
			array.forEach(files, function(file){
				if (/\.ejsn$/i.test(file.name) || /\.json$/i.test(file.name)) {
					var reader = new FileReader();
					reader.onload = function(e) {
						try{
							var layerData = JSON.parse(reader.result);
							if (Object.prototype.toString.apply(layerData) === '[object Array]'){
								array.forEach(layerData, function(layerDatum){
									var layer;

									if (layerDatum.type === 'feature'){
										layer = new FeatureLayer(layerDatum.data);
										self.createEditTool(layer);
									}else if (layerDatum.type === 'graphics'){
										layer = new GraphicsLayer({
											id: 'Imported_' + self.graphicLayers.length,
											title: 'Draw Graphics'
										});
										self.createEditTool(layer);

										array.forEach(layerDatum.data, function(graphic){
											layer.add(new Graphic(graphic));
										});
									}

									if (layer){
										self.map.addLayer(layer);
										self.graphicLayers.push(layer);
									}
								});
								topic.publish("map/showNotification", file.name + " added to map", "message");
							}else{
								self.showLoadFileError("File is corrupted and cannot be loaded.");
							}
						}catch(err){
							self.showLoadFileError("Error: " + err.message);
						}

						if (self.graphicLayers.length > 0){
							self.showGraphicsActionButtons();
						}
					};

					reader.readAsText(file);
				} else {
					self.showLoadFileError("File type not supported (must be .ejsn).");
				}
			});
		},

		loadFromFile: function(e){
			this.loadFiles(this.loadFileInput.files);
			this.loadFileInputForm.reset();
		},

		processOnDrop: function(files){
			this.loadFiles(files);
		},

		showLoadFileError: function(msg){
			this.loadFileErrorMessage.innerHTML = msg;
			domClass.remove(this.loadFileError, "hide");
			topic.publish("map/showNotification", msg, "error");
		},

		hideLoadFileError: function(){
			domClass.add(this.loadFileError, "hide");
		},

		createEditTool: function(layer){
			// Click on layer = move/scale
			// Double click on layer = edit vertices
			// click on map = disable editing
			var self = this;

			(function(){
				var editing = false;

				function deactivate(e){
					editing = false;
					self.editTool.deactivate();
				}

				function handleActivation(editTools){
					return function(evt) {
						evt.preventDefault();
						evt.stopPropagation();
						editing = true;
						self.editTool.activate(editTools, evt.graphic);
						self.setMapInfoWindowOnClick(false);
					};
				}

				function deleteLayer(layer){
					layer.clear();
					self.map.removeLayer(layer);
					
					var index = array.indexOf(self.graphicLayers, layer);
					if (index !== -1){
						self.graphicLayers.splice(index, 1);
					}

					if (layer._linkedLayer) deleteLayer(layer._linkedLayer);
				}

				layer.on("click",  handleActivation(Edit.MOVE | Edit.ROTATE | Edit.SCALE));
				layer.on("dbl-click", handleActivation(Edit.EDIT_VERTICES));
				on(window, "keyup", function(e){
					if (editing && e.keyCode === 46){
						deactivate();
						deleteLayer(layer);						
					}
				});
				self.map.on("click", deactivate);
			})();
		},

		onEditToolDeactivate: function(evt){
			this.setMapInfoWindowOnClick(true);
		},

		onEditToolInteractionEnded: function(evt){
			// Don't process updateMeasurements for text symbols
			if (!evt.graphic.symbol || evt.graphic.symbol.type !== "textsymbol"){
				var layer = evt.graphic.getLayer();
				if (layer.updateMeasurements) layer.updateMeasurements();
			}
		},

		exportToGeoJson: function(){
			var geojsonExport = {
				type: "FeatureCollection",
				features: []
			};

			array.forEach(this.graphicLayers, function(layer){
				array.forEach(layer.graphics, function(graphic){
					// Skip text layers
					if (graphic.symbol && graphic.symbol.text !== undefined) return;
					
					var graphicJson = graphic.toJson();
					graphicJson.geometry = webMercatorUtils.webMercatorToGeographic(graphic.geometry).toJson();
					var geojson = Terraformer.ArcGIS.parse(graphicJson);

					// Check for measurement texts and add them as properties
					if (layer._linkedLayer && layer._linkedLayer.graphics && layer._linkedLayer.graphics[0] && layer._linkedLayer.graphics[0].symbol){
						geojson.properties = {
							text: layer._linkedLayer.graphics[0].symbol.text
						};
					}
					geojsonExport.features.push(geojson);
				});
			});

			var blob = new Blob([JSON.stringify(geojsonExport)], {type: "text/plain;charset=utf-8"});
			saveAs(blob, "drawings.json");
		}

	});
});