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
define(["dojo/_base/array", "maple/config/project",
	"esri/layers/FeatureLayer", "maple/helpers/map/infoTemplate", "maple/helpers/utils"], 
	function(array, project, FeatureLayer, infoTemplate, Utils){
	"use strict";

	var search = project.get("config.widgets.Search.primary", {});

	// Search for a field that contains a particular flag set to true
	// @return field's name or null if no flag is found in any field
	function findField(fields, flag){
		var last;
		if (array.some(fields, function(field){
				last = field;
				return field.name && field[flag] === true;
			})){
			return last.name;
		}else {
			return null;
		}
	}

	return {
		// Build source list to allow search on a map
		// these are the sources that can be searched.
		getSources: function(){
			if (!search.layers || !search.layers.layer){
				console.warn("No search widget configuration available. No map sources will be available.");
				return [];
			}

			var sources = [];
			array.forEach(search.layers.layer, function(layer){
				if (layer.exclude) return;
				
				var displayField = findField(layer.fields.field, "display") || layer.titlefield;
				var idField = findField(layer.fields.field, "id") || "";
				Utils.arrayify(layer, "orderbyfields");

				sources.push({
					featureLayer: new FeatureLayer(layer.url),
					searchFields: [layer.titlefield],
					displayField: displayField,
					exactMatch: false,
					outFields: [array.map(layer.fields.field, function(field){
						return field.name;
					})],
					name: layer.name,
					placeholder: layer.textsearchlabel,
					maxResults: "foo", // per ESRI support, hack to disable pagination
					
					expression: layer.expression,
					orderByFields: layer.orderbyfields,

					idField: idField,

					infoTemplate: infoTemplate.create("${" + layer.titlefield + "}", layer.fields.field, {
						allVisible: true
					}),

					enableSuggestions: true,
					minCharacters: 0
				});
			});

			return sources;
		}
	};
});