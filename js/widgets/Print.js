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
   "dojo/_base/lang", "dojo/text!./Print.html",
   "dojo/dom", "dojo/on", "dojo/_base/array", "dojo/dom-class", "dojo/query", "dojo/topic", 
   "maple/helpers/widgets/common", "esri/tasks/PrintParameters", "esri/tasks/PrintTemplate",
   "esri/tasks/PrintTask",
   "maple/helpers/auth", "maple/config/server",
   "dijit/registry",
   "dojo/NodeList-dom",
   "dojox/mobile/Button",
   "dojox/mobile/Switch",
   "dojox/mobile/SimpleDialog"
], function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, 
	lang, template, 
	dom, on, array, domClass, query, topic, 
	common, PrintParameters, PrintTemplate,
	PrintTask,
	auth, server,
	registry) {

	return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
		widgetsInTemplate: true,
		templateString: template,
		windowWidth: window.innerWidth,
		windowHeight: window.innerHeight,

		buildRendering: function () {
			this.inherited(arguments);
			var self = this;

			var params = new PrintParameters();
			var template = new PrintTemplate();

			params.map = this.map;
			params.outSpatialReference = this.map.spatialReference;

			template.exportOptions = {
				width: this.windowWidth,
				height: this.windowHeight,
				dpi: 96
			};
			template.layoutOptions = {
				titleText: "",
				authorText: "",
				scalebarUnit: "Miles",
				legendLayers: []
			};
			template.preserveScale = true;
			template.layout = "MAP_ONLY";
			template.format = "jpg";


			params.template = template;
			this.template = template;
			this.printParams = params;
			this.printTask = new PrintTask(server.urls.printService, {async: false});

			this.format = common.createDropDown(this.formatDropDownButton, [
					{label: "JPG", value: "jpg"},
					{label: "PNG", value: "png32"},
					{label: "PDF", value: "pdf"}
				], function(label, value){
					self.template.format = value;
				});

			this.layout = common.createDropDown(this.layoutDropDownButton, [
					{label: "Map Only", value: "MAP_ONLY"},
					{label: "A3 Landscape", value: null},
					{label: "A3 Portrait", value: null},
					{label: "A4 Landscape", value: null},
					{label: "A4 Portrait", value: null},
					{label: "Letter ANSI A Landscape", value: null},
					{label: "Letter ANSI A Portrait", value: null},
					{label: "Tabloid ANSI B Portrait", value: null},
					{label: "Tabloid ANSI B Portrait", value: null}
				], function(label, value){
					if (label === "Map Only"){
						domClass.remove(self.printExportOptions, "hide");
					}else{
						domClass.add(self.printExportOptions, "hide");
					}

					self.template.layout = value || label;
				});

			this.dpi = common.createDropDown(this.dpiDropDownButton, [
					{label: "96", value: null},
					{label: "150", value: null},
					{label: "300", value: null}
				], function(label, value){
					self.template.exportOptions.dpi = parseInt(label);
				});

			on(this.title, "keyup", function(){
				self.template.layoutOptions.titleText = self.title.value;
			});
			on(this.width, "change", function(){
				self.template.exportOptions.width = self.width.value;
			});
			on(this.height, "change", function(){
				self.template.exportOptions.height = self.height.value;
			});
			registry.byId("printPreserveOption").on("stateChanged", function(newValue){
				self.template.preserveScale = newValue === "on";
			});

			this.exportOpenFile.on("click", function(){
				self.openExportFile();
			});
		},

		print: function(){
			var self = this;
			var done = function(){
				domClass.add(self.exporting, "hide");
				self.exportButton.domNode.style.display = 'inline-block';
			};
			var showError = function(){
				domClass.remove(self.error, "hide");
			};

			// Show exporting...
			this.exportButton.domNode.style.display = 'none';
			domClass.remove(this.exporting, "hide");
			domClass.add(this.error, "hide");

			// Print
			this.printTask.execute(this.printParams, function(result){
				self._lastPrintUrl = result.url;
				self.exportDialog.show();
				done();
			}, function(e){
				showError();
				done();
			});
		},

		openExportFile: function(){
			window.open(this._lastPrintUrl);
			this.exportDialog.hide();
		}
	});
});