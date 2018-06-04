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
 "dojo/text!./AddDataLayers.html",
 "maple/external/SimpleAjaxUploader",
 "esri/layers/KMLLayer",
 "maple/config/server",
 "dojo/dom-class", "dojo/on", "dojo/query", "dojo/_base/lang", "dojo/_base/array",
 "dojo/topic",
 "dojo/sniff",
 "esri/geometry/scaleUtils", "esri/layers/FeatureLayer", "esri/request",
 "maple/external/geojsonlayer",
 "maple/helpers/utils", "maple/helpers/map/infoTemplate",
 "esri/symbols/SimpleMarkerSymbol",
 "esri/symbols/SimpleLineSymbol",
 "esri/symbols/SimpleFillSymbol",
 "esri/Color",
 "maple/helpers/widgets/common",
 "maple/config/project",
 "dojox/mobile/Button",
 "dojo/NodeList-manipulate"
], function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
	template, SimpleAjaxUploader, KMLLayer, server,
	domClass, on, query, lang, array,
	topic, sniff,
	scaleUtils, FeatureLayer, request,
	GeoJsonLayer, utils, InfoTemplate,
	SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol,
	Color, common, project) {

	return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
		widgetsInTemplate: true,
		templateString: template,

		createSymbols: function(){
			this.symbols = {}; 

			this.symbols.pointSymbol = new SimpleMarkerSymbol(
						common.pointStyles[0].value, 
						parseInt(this.pointSize.value), 
						new SimpleLineSymbol(common.outlineStyles[0].value, 
												new Color(this.outlineColor.value), 
												parseInt(this.lineThickness.value)),
						new Color(this.fillColor.value));
			this.symbols.pointSymbol.color.a = 0.5; // ESRI Color constructor does not support alpha from hex conversion

			this.symbols.polylineSymbol = new SimpleLineSymbol(common.outlineStyles[0].value, 
													new Color(this.outlineColor.value), 
													parseInt(this.lineThickness.value));

			this.symbols.polygonSymbol = new SimpleFillSymbol(common.fillStyles[0].value, 
													new SimpleLineSymbol(
															common.outlineStyles[0].value, 
															new Color(this.outlineColor.value), 
															parseInt(this.lineThickness.value)
														),
													new Color(this.fillColor.value));
			this.symbols.polygonSymbol.color.a = 0.5; // ESRI Color constructor does not support alpha from hex conversion
		},

		buildRendering: function () {
			this.inherited(arguments);
			var self = this;

			this.createSymbols();
			
			// Default values
			var projections = [{
				label: "Lat/Lon (EPSG:4326)", 
				value: 4326
			}];
	
			// Sometimes we have a widget specifying projection values			
			var widget = project.config.widgetcontainer.findFirst("ImportDataFile");
			if (widget){
				// Do we have projection settings?
				if (widget.config && widget.config.inputdataprojection && widget.config.inputdataprojection.proj){
					var widgetProjections = widget.config.inputdataprojection.proj.map(function(proj){
							// Check deprecated 102100 code
							var wkid = proj.wkid;
							if (wkid === 102100){
								wkid = 3857;
								console.warn("Deprecated wkid 102100, replacing with 3857");
							}

							return {label: proj.name, value: wkid};
						});

					if (widget.config.defaultproj){
						widgetProjections.sort(function(a, b){
							if (widget.config.defaultproj === a.value) return -1;
							else if (widget.config.defaultproj === b.value) return 1;
							else return 0;
						});
					}

					if (widgetProjections.length > 0) projections = widgetProjections;
				}
			}

			this.csvProjection = common.createDropDown(this.csvProjectionDropDownButton, projections, 
				function(label, value){
					uploadParams.csvProjection = value;
				});

			this.outlineStyle = common.createDropDown(this.outlineStyleDropDownButton, common.outlineStyles, function(label, value){
				self.symbols.polygonSymbol.outline.setStyle(value);
				self.symbols.polylineSymbol.setStyle(value);
			});

			this.fillStyle = common.createDropDown(this.fillStyleDropDownButton, common.fillStyles, function(label, value){
				self.symbols.polygonSymbol.setStyle(value);
			});

			this.pointStyle = common.createDropDown(this.pointStyleDropDownButton, common.pointStyles, function(label, value){
				self.symbols.pointSymbol.setStyle(value);
			});

			on(this.pointSize, "change", function(){
				self.symbols.pointSymbol.setSize(self.pointSize.value);
			});

			on(this.lineThickness, "change", function(){
				var value = self.lineThickness.value;
				self.symbols.pointSymbol.outline.setWidth(value);
				self.symbols.polylineSymbol.setWidth(value);
				self.symbols.polygonSymbol.outline.setWidth(value);
			});

			var createColorPicker = common.colorPickerCreator();
			createColorPicker(this.fillColor, function(color){
				self.symbols.pointSymbol.setColor(color);
				self.symbols.polygonSymbol.setColor(color);
			});
			createColorPicker(this.outlineColor, function(color){
				self.symbols.polylineSymbol.setColor(color);
				self.symbols.pointSymbol.outline.setColor(color);
				self.symbols.polygonSymbol.outline.setColor(color);
			});

			var uploaderComponents = {};
			var uploadParams = {
				csvProjection: projections[0].value
			};

			this.uploader = new SimpleAjaxUploader.SimpleUpload({
				button: [
							self.kmlUploadButton.domNode, 
							self.csvUploadButton.domNode, 
							self.shapefileUploadButton.domNode,
							self.geoJsonUploadButton.domNode
						],
				url: '/server/uploader/geoJsonConvert.php',
				progressUrl: '/server/uploader/include/uploadProgress.php',
				responseType: 'json',
				name: 'uploadfile',
				data: uploadParams,
				multiple: true,
				allowedExtensions: ['kml', 'kmz', 'zip', 'csv', 'json'],
				hoverClass: 'ui-state-hover',
				focusClass: 'ui-state-focus',
				disabledClass: 'ui-state-disabled',	
				debug: false, 
				onSubmit: function(filename, extension) {
					// Create the elements of our progress bar
					var progress = document.createElement('div'), // container for progress bar
						bar = document.createElement('div'), // actual progress bar
						perc = document.createElement('div'), // container for upload file size
						wrapper = document.createElement('div'), // container for this progress bar
						progressBox = self.progressBox; // on page container for progress bars

					// Assign each element its corresponding class
					progress.className = 'progress';
					bar.className = 'bar';	
					perc.className = 'perc';
					wrapper.className = 'uploader-wrapper relative';

					// Assemble the progress bar and add it to the page
					progress.appendChild(bar); 
					wrapper.innerHTML = '<div class="filename">'+filename+'</div>'; // filename is passed to onSubmit()
					wrapper.appendChild(perc);
					wrapper.appendChild(progress);	 
					progressBox.appendChild(wrapper); // just an element on the page to hold the progress bars	

					// Assign roles to the elements of the progress bar
					this.setProgressBar(bar); // will serve as the actual progress bar
					this.setPctBox(perc); // display file size beside progress bar
				
					uploaderComponents[filename] = {
						wrapper: wrapper,
						perc: perc,
						bar: bar
					};
				},

				 // Do something after finishing the upload
				 // Note that the progress bar will be automatically removed upon completion because everything 
				 // is encased in the "wrapper", which was designated to be removed with setProgressContainer() 
				onComplete:	 function(filename, response) {
					
					function showError(msg){
						domClass.add(uploaderComponents[filename].bar, "failure");
						domClass.add(uploaderComponents[filename].wrapper, "completed");
						uploaderComponents[filename].perc.innerHTML = msg;

						topic.publish("map/showNotification", filename + ": " + msg, "error");
					}

					if (!response) {
						showError("Server unavailable.");
					}else{
						if (response.success){
							uploaderComponents[filename].perc.innerHTML = "Processing...";
							var ext = utils.File.getExtension(filename).toLowerCase();
							var symbols = {
								pointSymbol: new SimpleMarkerSymbol(self.symbols.pointSymbol.toJson()),
								polylineSymbol: new SimpleLineSymbol(self.symbols.polylineSymbol.toJson()),
								polygonSymbol: new SimpleFillSymbol(self.symbols.polygonSymbol.toJson())
							};

							var infoTemplate = InfoTemplate.create("", null, {
								getFieldsFromAttributes: true
							});

							var layer = new GeoJsonLayer({
								data: response.geojson,
								onLoad: function() {
									domClass.add(uploaderComponents[filename].bar, "success");
									uploaderComponents[filename].perc.innerHTML = "Layer added";
									domClass.add(uploaderComponents[filename].wrapper, "completed");

									self.map.setExtent(layer.extent);
									topic.publish("viewer/layerAdded", layer);
									topic.publish("map/showNotification", filename + " added to map", "message");
								},
								infoTemplate: infoTemplate,
								defaultSymbols: symbols
							});
							layer.configType = 'feature';
							var layerIdBase = filename.replace(/\.(\w+)$/i, "");
							var layerId = layerIdBase;
							
							// // Check if a layer with the same ID already exists
							var count = 1;
							while (self.map.getLayer(layerId)){
								layerId = layerIdBase + " " + count++;
							}

							layer.id = layerId;
							self.map.addLayer(layer);
						}else{
							console.log(response);
							showError(response.msg || "Error occurred.");
						}
					}
				}
			});

			// Handle dismissal of messages
			on(this.domNode, "click", function(){
				query("#addDataLayers .completed").remove();
				domClass.add(self.error, "hide");

				if (domClass.contains(self.shapeFileStatusWrapper, "done")){
					domClass.remove(self.shapeFileStatusWrapper, "done");
					domClass.add(self.shapeFileStatusWrapper, "hide");
				}
			});
		},

		processOnDrop: function(files){
			if (this.uploader){
				this.uploader._addFiles(files);
		        this.uploader._cycleQueue();
			}
		}
	});
});