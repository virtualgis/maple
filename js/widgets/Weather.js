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
	 "dojo/_base/lang", "dojo/_base/array", "dojo/text!./Weather.html",
	 "maple/config/project",	"esri/layers/WebTiledLayer",
	 "dojo/on", "dojo/dom-class", "dijit/registry",
	 "maple/helpers/utils", "dojo/date/locale",
	 "dojox/mobile/Switch",
	 "maple/widgets/Slider",
	 "dojox/mobile/Button"
], function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
	lang, array, template, 
	project, WebTiledLayer,
	on, domClass, registry,
	utils, locale) {

	return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
		widgetsInTemplate: true,
		templateString: template,

		layers: [],
		currentLayerIndex: 0,
		currentLayer: null,
		switchLayerInterval: null,
		playing: false,
		dateFormat: "",

		constructor: function (params) {
			this.inherited(arguments);
			this.map = params.map;
			this.widget = project.config.widgetcontainer.findAllFlat("WMSLooping")[0]; // Use first only
		},

		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

			utils.preloadImages(["/images/pause.svg"]);

			// Build layers
			if (this.widget.config.layersToRotate.layer.length === 0) return;
			var subDomains = [ "mesonet" ];

			array.forEach(this.widget.config.layersToRotate.layer, function(layer){
				var tile = new WebTiledLayer(window.location.protocol + "//${subDomain}.agron.iastate.edu/cache/tile.py/1.0.0/" + layer.$t + "/${level}/${col}/${row}.png", {
					id: "weather_" + layer.$t,
					subDomains: subDomains
				});
				tile.offsetMins = layer.offsetMins;
				self.map.addLayer(tile);

				tile.setOpacity((self.widget.config.opacityDefault / 100) || 0.9);

				self.layers.push(tile);
			});

			// Build UI
			this.about.innerHTML = this.widget.config.about || "";

			registry.byId("weatherRadarOption").on("stateChanged", function(newValue){
				if (newValue === "on"){
					self.startRadar();
				}else{
					self.stopRadar();
				}
			});

			this.opacity.set('value', this.widget.config.opacityDefault || 90);
			on(this.opacity, "change", function(){
				if (self.currentLayer !== null){
					self.currentLayer.setOpacity(parseInt(self.opacity.value) / 100);
				}
			});

			this.dateFormat = utils.convertDateFormat(this.widget.config.dateFormatString || "YYYY-MM-DD L:NN A");

			this.startRadar();
		},

		startRadar: function(){
			domClass.remove(this.radarControls, 'hide');

			// Start from first layer
			this.currentLayerIndex = 0;
			array.forEach(this.layers, function(layer){
				layer.setVisibility(true);
				layer.setOpacity(0);
				layer.resume();
			});
			this.currentLayer = this.layers[0];
			this.currentLayer.setOpacity(parseInt(this.opacity.value) / 100);

			this.startPlaying();
		},

		stopRadar: function(){
			domClass.add(this.radarControls, 'hide');

			array.forEach(this.layers, function(layer){
				layer.setVisibility(false);
				layer.suspend();
			});
			this.stopPlaying();
			this.currentLayer = null;
		},

		stopPlaying: function(){
			this.playing = false;
			this._onPlayPauseChanged();
		},

		startPlaying: function(){
			this.playing = true;
			this._onPlayPauseChanged();
		},

		togglePlay: function(){
			this.playing = !this.playing;
			this._onPlayPauseChanged();
		},

		_onPlayPauseChanged: function(){
			var self = this;
			function showNextLayer(){
				var current = self.layers[self.currentLayerIndex];
				var next = self.layers[(self.currentLayerIndex + 1) % self.layers.length];
				
				current.setOpacity(0);
				next.setOpacity(parseInt(self.opacity.value) / 100);
				self.currentLayer = next;

				self.setTimeIndicator(self.currentLayer);

				if (++self.currentLayerIndex >= self.layers.length){
					self.currentLayerIndex = 0;
				}
			}

			if (this.switchLayerInterval) clearInterval(this.switchLayerInterval);
			
			if (this.playing){
				// Play
				domClass.remove(this.buttonTogglePlay.domNode, "iconPlay");
				domClass.add(this.buttonTogglePlay.domNode, "iconPause");
			
				this.switchLayerInterval = setInterval(showNextLayer, this.widget.config.timerMsPerLayer || 2000);
			
				array.forEach(this.layers, function(layer){
					layer.resume();
				});
			}else{
				// Pause
				domClass.remove(this.buttonTogglePlay.domNode, "iconPause");
				domClass.add(this.buttonTogglePlay.domNode, "iconPlay");
			}
		},

		setTimeIndicator: function(currentLayer){
			// Now - offset in minutes of current layer
			// Well, should be minus the last radar update time,
			// but since it's "real time" it's close enough.
			var date = new Date((new Date()).getTime() + (1000 * 60 * currentLayer.offsetMins));
			this.dateDisplay.innerHTML = locale.format(date, {
				selector: "date",
				datePattern: this.dateFormat
			});
		}
	});
});