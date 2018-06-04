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
define("maple/widgets/Edit", ["dojo/_base/declare", "dijit/_WidgetBase", "dijit/_WidgetsInTemplateMixin",
		"dojo/text!maple/widgets/Edit.html",
		"dijit/_TemplatedMixin",
		"dojo/Evented","maple/config/project", "dojo/_base/array", "maple/helpers/ui",
		"maple/helpers/utils", "dojo/on", "dojo/dom-class", "dojo/has",
		"esri/dijit/editing/Editor",
        "esri/dijit/editing/TemplatePicker",
        "dijit/registry", "dojo/topic", "jquery",
        "dojox/mobile/Switch"],
function(declare, _WidgetBase, _WidgetsInTemplateMixin, template, 
		_TemplatedMixin, Evented, project, array, ui, utils,
		on, domClass, has, Editor, TemplatePicker,
		registry, topic, $){

	var map;

	return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
		widgetsInTemplate: true,
		templateString: template,

		constructor: function(params, srcNodeRef){
			this.inherited(arguments);
			map = params.map;

			this.config = project.config.widgetcontainer.findAllFlat("Edit")[0].config;
		},

		buildRendering: function(){
			this.inherited(arguments);

			// Setup config
			var config = this.config;
			utils.arrayify(config, "layersettings.layer");

			// Setup templates
			var layerInfos = [],
				disableGeometryUpdate = !utils.get(config, "updategeometry", true),
				disableAttributeUpdate = !utils.get(config, "updateattributes", true);

			array.forEach(config.layersettings.layer, function(layerConfig){
				var featureLayer = map.getLayer(layerConfig.name);
				if (featureLayer){
					var layerInfo = {
						featureLayer: featureLayer,
						disableGeometryUpdate: disableGeometryUpdate,
						disableAttributeUpdate: disableAttributeUpdate
					};

					if (layerConfig.fields && layerConfig.fields.field){
						utils.arrayify(layerConfig, "fields.field");
						layerInfo.fieldInfos = array.map(layerConfig.fields.field, function(field){
							return {
								fieldName: field.name,
								isEditable: field.editable !== undefined ? field.editable : true,
								label: field.alias !== undefined ? field.alias : field.name
							};
						});
					}

					layerInfos.push(layerInfo);
				} 
			});
			
			var self = this;
			function enableEdit(){
				$(self.templateContainer).append($('<div id="disposableTemplateContainer"></div>'));
				$(self.editorContainer).append($('<div id="disposableEditorContainer"></div>'));

				self.templatePicker = new TemplatePicker({
					featureLayers: array.map(layerInfos, function(layerInfo){
						return layerInfo.featureLayer;
					}),
					grouping: true,
					columns: has("touch") ? 3 : 4,
				}, 'disposableTemplateContainer');
				self.templatePicker.startup();

				self.editor = new Editor({settings: {
					map: map,
					templatePicker: self.templatePicker,
					layerInfos: layerInfos,
					toolbarVisible: utils.get(config, "toolbarvisible", true),
					createOptions: {
					  polylineDrawTools:[ Editor.CREATE_TOOL_FREEHAND_POLYLINE ],
					  polygonDrawTools: [ Editor.CREATE_TOOL_FREEHAND_POLYGON,
					    Editor.CREATE_TOOL_CIRCLE,
					    Editor.CREATE_TOOL_TRIANGLE,
					    Editor.CREATE_TOOL_RECTANGLE
					  ]
					},
					toolbarOptions: {
					  reshapeVisible: utils.get(config, "toolbarreshapevisible", true),
					  mergeVisible: utils.get(config, "toolbarmergevisible", true),
					  cutVisible: utils.get(config, "toolbarreshapevisible", true)
					},
					enableUndoRedo: true
				}}, 'disposableEditorContainer');
				self.editor.startup();

				topic.publish("map/removeClicks", this);
				topic.publish("popup/dontPreventShow");
				map.setInfoWindowOnClick(false);
				
				if (has("touch")){
					map.infoWindow.clearFeatures();
				}
			}

			setTimeout(function(){
				enableEdit();
			}, 300);

			function disableEdit(){
				self.editor.stopEditing();
				self.editor.destroy();
				self.templatePicker.destroy();
				map.setInfoWindowOnClick(true);
			}

			registry.byId("enableEditOption").on("stateChanged", function(newValue){
				if (newValue === "on"){
					enableEdit();
				}else{
					disableEdit();
				}
			});

			// On mobile, we patch _showInfoWindow to force display of
			// the expand arrow button for the popup. For some reason,
			// ESRI decided not to support PopupMobile.
			if (has("touch")){
				utils.intercept(Editor, '_showInfoWindow', function(original){
					original();
					
					domClass.remove(map.infoWindow._arrowButton, "hidden");
					
					// The editor has its own buttons for rotating features
					// so we hide the ones from the popup
					domClass.add(map.infoWindow._prevFeatureButton, "hidden");
					domClass.add(map.infoWindow._nextFeatureButton, "hidden");
				});
			}

		}
	});
});