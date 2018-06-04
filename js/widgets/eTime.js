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
	 "dojo/_base/declare", "dijit/_WidgetBase", "dijit/_TemplatedMixin",
	 "dojo/_base/lang", "dojo/_base/array", "dojo/text!./eTime.html",
	 "maple/helpers/widgets/common",
	 "dojo/dom-construct", "dojo/on", "dojo/query", "dojo/dom-class", "maple/config/server", "dojo/Evented",
	 "dojo/topic", "maple/config/project",
	 "esri/TimeExtent", "esri/dijit/TimeSlider", "esri/layers/TimeInfo",
	 "dojo/date/locale", "maple/helpers/utils",
	 "dojo/NodeList-dom"
], function (declare, _WidgetBase, _TemplatedMixin, 
	lang, array, template, 
	common,
	domConstruct, on, query, domClass, server, Evented,
	topic, project,
	TimeExtent, TimeSlider, TimeInfo,
	locale, utils) {

	return declare([_WidgetBase, _TemplatedMixin, Evented], {
		widgetsInTemplate: false,
		templateString: template,

		timelayerlabel: null,
		layers: [],
		timeSlider: null,
		currentLayer: null,
		config: null,

	
		constructor: function (params) {
			this.inherited(arguments);
			this.map = params.map;

			var self = this;

			this.widgets = project.config.widgetcontainer.findAllFlat("eTime");

			array.forEach(this.widgets, function(widget){
				if (widget.config.layers && widget.config.layers.layer){
					array.forEach(widget.config.layers.layer, function(layer){

						// Only add layers that exist in the map
						var mapLayer;
						if ((mapLayer = self.map.getLayer(layer.name))){
							layer.id = layer.name;
							layer.mapLayer = mapLayer;
							self.layers.push(layer);
						}
					});
				}
				if (widget.config.labels && widget.config.labels.timelayerlabel){
					self.timelayerlabel = widget.config.labels.timelayerlabel;
				}
			});

			this.timelayerlabel = (typeof this.timelayerlabel === "string") ? 
									this.timelayerlabel :
									"";

			// Use the first widget for global config params
			this.config = this.widgets[0].config;
		},

		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

			utils.preloadImages(["/images/pause.svg"]);

			this.timeSlider = new TimeSlider({
				style: "width: auto;"
			}, this.timeSlider);
			this.map.setTimeSlider(this.timeSlider);
			
			this.selectedLayer = common.createDropDown(this.selectedLayerDropDownButton, 
				array.map(this.layers, function(layer){
					return {label: layer.label, value: layer};
				}), function(label, value){
					self.selectLayer(value);
				});
			
			this.selectLayer(this.layers[0]);

			this.timeSlider.on("time-extent-change", function(evt) {
				self.setTimeIndicator(evt.endTime);
			});
		},

		setTimeIndicator: function(date){
			this.timeIndicator.innerHTML = locale.format(date, {
				selector: "date",
				datePattern: utils.convertDateFormat(this.currentLayer.dateformat)
			});
		},

		convertTimeUnit: function(str){
			switch(str.toLowerCase()){
				case "centuries":
					return TimeInfo.UNIT_CENTURIES;
				case "days":
					return TimeInfo.UNIT_DAYS;
				case "decades":
					return TimeInfo.UNIT_DECADES;
				case "hours":
					return TimeInfo.UNIT_HOURS;
				case "milliseconds":
					return TimeInfo.UNIT_MILLISECONDS;
				case "minutes":
					return TimeInfo.UNIT_MINUTES;
				case "months":
					return TimeInfo.UNIT_MONTHS;
				case "seconds":
					return TimeInfo.UNIT_SECONDS;
				case "unknown":
					return TimeInfo.UNIT_UNKNOWN;
				case "weeks":
					return TimeInfo.UNIT_WEEKS;
				case "years":
					return TimeInfo.UNIT_YEARS;
				default:
					console.warn("Cannot handle time unit: " + str);
					return "";
			}
		},

		selectLayer: function(layer){
			this.currentLayer = layer;

			var timeExtent = new TimeExtent();
			timeExtent.endTime = timeExtent.startTime = new Date();

			if (layer.timeextent){
				if (layer.timeextent.setfromlayer){
					var mapLayer = this.map.getLayer(layer.timeextent.setfromlayer);
					if (mapLayer !== undefined){
						timeExtent.startTime = mapLayer.timeInfo.timeExtent.startTime;
						timeExtent.endTime = (mapLayer.timeInfo.timeExtent.endTime > new Date()) ? 
												new Date() : 
												mapLayer.timeInfo.timeExtent.endTime;
					}else{
						console.warn("Invalid setfromlayer property " + layer.timeextent.setfromlayer);
					}
				}else if (layer.timeextent.starttime && layer.timeextent.endtime){
					timeExtent.startTime = new Date(layer.timeextent.starttime);
					timeExtent.endTime = new Date(
						this.config.startatoldesttime ? 
						new Date():
						layer.timeextent.endtime
					);
				}
			}


			// Compute ESRI time unit and save it to layer object
			layer.timeUnit = this.convertTimeUnit(layer.timestops.timestopsunits);

			this.timeSlider.setThumbCount(layer.thumbcount);
			this.timeSlider.createTimeStopsByTimeInterval(timeExtent, layer.timestops.timestopsinterval, layer.timeUnit);
			this.timeSlider.singleThumbAsTimeInstant(layer.singlethumbastimeinstant || false);

			var indexes = [];
			for (var i = 0; i < layer.thumbcount; i++){
				indexes.push(i);
			}
			this.timeSlider.setThumbIndexes(indexes);
			this.timeSlider.setThumbMovingRate(layer.thumbmovingrate);
			this.timeSlider.startup();

			this.setTimeIndicator(timeExtent.startTime);
			if (this.config.autotogglelayervisibility){
				for (i = 0; i < this.layers.length; i++){
	           	 	this.layers[i].mapLayer.setVisibility(this.layers[i] === layer);
					topic.publish("layerControl/setLayerVisibility", {
						layer: this.layers[i],
						visible: this.layers[i] === layer
					});
				}
			}

			if (this.config.startatoldesttime){
				this.timeSlider._bumpSlider(4294967295);
			}
		},

		onOpen: function(){
			// Select last layer if available
			if (this.currentLayer){
				this.selectLayer(this.currentLayer);
			}
		},

		onClose: function(){
			// Hide current layer (if necessary)
			if (this.config.autotogglelayervisibility){
				var layer = this.currentLayer;
				layer.mapLayer.setVisibility(false);
				topic.publish("layerControl/setLayerVisibility", {
					layer: layer,
					visible: false
				});
			}
		}
	});
});