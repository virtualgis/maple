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
   "dojo/_base/lang", "dojo/text!./ElevationProfile.html",
   "maple/helpers/widgets/common", "esri/units", "esri/toolbars/draw", 
   "esri/symbols/CartographicLineSymbol", "esri/symbols/SimpleLineSymbol",
   "esri/graphic", "esri/dijit/ElevationProfile", "esri/Color",
   "dojo/dom-construct", "dojo/on", "dojo/query", "dojo/dom-class", "maple/config/server", "dojo/Evented",
   "dojo/topic",
   "dojo/NodeList-dom"
], function (declare, _WidgetBase, _TemplatedMixin, 
	lang, template, 
	common, Units, Draw, 
	CartographicLineSymbol, SimpleLineSymbol, 
	Graphic, ElevationProfileWidget, Color,
	domConstruct, on, query, domClass, server, Evented,
	topic) {

	return declare([_WidgetBase, _TemplatedMixin, Evented], {
		widgetsInTemplate: false,
		templateString: template,

		toolBar: null,
		epWidget: null,
		_lastDrawTool: null,
		_drawEndHandler: null,

		buildRendering: function () {
			this.inherited(arguments);
			var self = this;

			this.distanceUnit = common.createDropDown(this.distanceUnitDropDownButton, [
					{label: "Miles", value: Units.MILES},
					{label: "Kilometers", value: Units.KILOMETERS},
					{label: "Meters", value: Units.METERS},
					{label: "Nautical Miles", value: Units.NAUTICAL_MILES},
					{label: "Yards", value: Units.YARDS},
					{label: "Feet", value: Units.FEET}
				], function(label, value){
					if (self.epWidget) {
						self.epWidget.set("measureUnits", value);
					}
				});

			this.lineSymbol = new CartographicLineSymbol(
							CartographicLineSymbol.STYLE_SOLID,
							new Color([255, 0, 0]), 2,
							CartographicLineSymbol.CAP_ROUND,
							CartographicLineSymbol.JOIN_MITER, 2
					);
			this.toolBar = new Draw(this.map);

			topic.subscribe("map/removeClicks", lang.hitch(this, function(sender){
				if (sender !== this){
					this.unselectAllTools();
					this.toolBar.finishDrawing();
				}
			}));

			on(window, "orientationchange", function(){
				self.resizeChart();
			});
		},

		startup: function(){
			this.inherited(arguments);
			var self = this;

			var profileParams = {
				map: this.map,
				profileTaskUrl: server.urls.elevationService,
				scalebarUnits: Units.MILES,
				chartOptions: {
					indicatorFontColor: "#000",
					indicatorFillColor: "#fff",
					titleFontColor: "#000",
					axisFontColor: "#000",
					axisMajorTickColor: "#333",
					skyTopColor: "#B0E0E6",
					skyBottomColor: "#4682B4",
					waterLineColor: "#000",
					waterTopColor: "#ADD8E6",
					waterBottomColor: "#0000FF",
					elevationLineColor: "#D2B48C",
					elevationTopColor: "#8B4513",
					elevationBottomColor: "#CD853F"
				}
			};

			setTimeout(function(){
				self.epWidget = new ElevationProfileWidget(
					profileParams, 
					self.epChart
				);
				self.epWidget.startup();
				self.emit("load", {});
			}, 0);
		},

		unselectAllTools: function(){
			query("#elevationProfile a.button").removeClass("selected");
		},

		setDrawTool: function(e, tool){
			var self = this;
			topic.publish("map/removeClicks", this);

			function addGraphic(evt) {
				//deactivate the toolbar and clear existing graphics
				self.toolBar.deactivate();
				self.map.enableMapNavigation();
				self.map.graphics.add(new Graphic(evt.geometry, self.lineSymbol));
				self.epWidget.set("profileGeometry", evt.geometry);

				if (self._drawEndHandler){
					self._drawEndHandler.remove();
					self._drawEndHandler = null;
				}

				self.setMapInfoWindowOnClick(true);
			}
			this.unselectAllTools();
			this.epWidget.clearProfile();
			this.map.graphics.clear();

			if (tool !== this._lastDrawTool){
				domClass.add(e.target, "selected");
				this._lastDrawTool = tool;
				this.setMapInfoWindowOnClick(false);

				this._drawEndHandler = this.toolBar.on("draw-end", addGraphic);
				this.toolBar.activate(tool);
				this.map.disableMapNavigation();
			}else{
				this._lastDrawTool = null;
				this.toolBar.deactivate();
				this.map.enableMapNavigation();
				if (this._drawEndHandler){
					this._drawEndHandler.remove();
					this._drawEndHandler = null;
				}
				this.setMapInfoWindowOnClick(true);
			}
		},

		setMapInfoWindowOnClick: function (flag) {
			this.map.setInfoWindowOnClick(flag);
		},

		setDrawLine: function(e){ this.setDrawTool(e, Draw.POLYLINE); },
		setDrawFreeLine: function(e){ this.setDrawTool(e, Draw.FREEHAND_POLYLINE); },

		maximize: function(){
			domClass.toggle(this.epChartContainer, "maximized");

			// Move the node out of the menu when it's maximized
			if (domClass.contains(this.epChartContainer, "maximized")){
				domConstruct.place(this.epChartContainer, this.map.container, 'last');
			}else{
				domConstruct.place(this.epChartContainer, this.domNode, 'last')
			}

			this.resizeChart();
		},

		resizeChart: function(){
			this.epWidget._profileChart.resize();
		}
	});
});