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
define("maple/widgets/Locate", ["dojo/_base/declare", "dijit/_WidgetBase", 
		"dojo/text!maple/widgets/Locate/Locate.html",
		"dojo/text!maple/widgets/Locate/Locate.WidgetContainer.html",
		"dijit/_TemplatedMixin",
		"dojo/Evented","maple/config/project", "dojo/_base/array", "maple/helpers/ui",
		"dojo/on", "dojo/has", "dojo/dom-class",
		 "esri/tasks/locator", "esri/geometry/Point", "maple/helpers/widgets/common",
		 "maple/helpers/map/infoTemplate"],
function(declare, _WidgetBase, template, widgetTemplate,
		_TemplatedMixin, Evented, project, array, ui,
		on, has, domClass, Locator, Point, common, infoTemplate){

	var WidgetContainer = declare([_WidgetBase, _TemplatedMixin, Evented], {
		templateString: widgetTemplate,
		searchPlaceholder: "Chicago or 41.881832,-87.623177",

		constructor: function(params, srcNodeRef){
			this.inherited(arguments);

			this.locator = new Locator(params.config.locator || "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer");
			this.locator.outSpatialReference = map.spatialReference;

			this.zoomscale = parseInt(params.config.zoomscale) || 10000;

			this.latLonRegexp = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
		},

		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

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

				hints: function(text){
					if (text !== ""){
						// If it's a lat/lon input, simply return the text
						if (self.latLonRegexp.test(text)){
							var parts = text.split(",");

							self.searchBoxControl.addHint(text, {
									point: new Point(parseFloat(parts[1]), parseFloat(parts[0]))
								}, text);
							self.searchBoxControl.onHintsRetrieved(text);
						}else{
							// Ask geolocator to resolve the text (likely an address)
							self.locator.suggestLocations({
									text: text,
									maxSuggestions: 3
								}).then(function(suggestions){
									for (var i = 0; i < suggestions.length; i++){
										self.searchBoxControl.addHint(suggestions[i].text, suggestions[i], text);
									}
									self.searchBoxControl.onHintsRetrieved(text);
								}, function(errMessage){
									self.searchBoxControl.showError(errMessage);
								});
						}

					}
				},
				onSelectHint: function(location, label){
					self.searchbox.value = label;
					self.searchBoxControl.showSpinner();
					
					if (location.point){
						common.zoomTo(location.point, map, self.zoomscale, {
											title: "",
											content: infoTemplate.getFieldHtml("Latitude:", location.point.getLatitude()) +
							  						 infoTemplate.getFieldHtml("Longitude:", location.point.getLongitude()),
					  						mobileTitle: "<div class='latLonLabel'>Lat: " + location.point.getLatitude() + "<br/>Lon: " + location.point.getLongitude() + "</div>"
										}, self.searchButton);
						self.searchBoxControl.hideSpinner();
					}else{
						// Search location
						self.locator.addressToLocations({
							address: {
								"SingleLine": label
							},
							maxLocations: 1
						}).then(function(results){
							if (Object.prototype.toString.call(results) === "[object Array]" && results.length > 0){
								if (results[0].location){
									self.searchBoxControl.hideSpinner();
									var p = new Point(results[0].location);
									common.zoomTo(p, map, self.zoomscale, {
											title: "",
											content: infoTemplate.getFieldHtml("", label),
											mobileTitle: label
										}, self.searchButton);
								}else{
									self.searchBoxControl.showError("The GeocodeServer returned a result, but no location information was found. Please try again later.");
								}
							}else{
								self.searchBoxControl.showError("The GeocodeServer did not reply correctly. Please try again later.");
							}
						}, function(err){
							self.searchBoxControl.showError(err);
						});
					}
				}
			});

			// Focus searchbox when item is opened
			if (!has("touch")){
				on(this.title, "click", function(){
					// About to be opened
					if (!domClass.contains(self.item, "open")){
						self.searchBoxControl.clearSearch();
						setTimeout(function(){
							self.searchbox.focus();
						}, 500);
					}
				});
			}
		}
	});
	WidgetContainer.createNew = function(widget){
		return new WidgetContainer({
			label: widget.label,
			icon: project.config.getPath(widget.icon),
			config: widget.config
		});
	};

	var map;

	return declare("maple/widgets/Locate", [_WidgetBase, _TemplatedMixin], {
		templateString: template,

		constructor: function(params, srcNodeRef){
			this.inherited(arguments);

			map = params.map;

			// Get locate widgets
			this.widgets = project.config.widgetcontainer.findAll("Locate");
		},

		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

			array.forEach(this.widgets, function(widget){
				obj = WidgetContainer.createNew(widget);
				obj.placeAt(self.locateWidgets);

				ui.setMenuItemExpandable(obj.title);
			});
		},

		startup: function(){
			this.inherited(arguments);

			this.emit("load", {});
		}
	});
});