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
define("maple/widgets/Links", ["dojo/_base/declare", "dijit/_WidgetBase", 
		"dojo/text!maple/widgets/Links/Links.html",
		"dojo/text!maple/widgets/Links/Links.WidgetContainer.html",
		"dojo/text!maple/widgets/Links/Links.Item.html",
		"dijit/_TemplatedMixin",
		"dojo/Evented","maple/config/project", "dojo/_base/array", "maple/helpers/ui",
		"dojo/on"],
function(declare, _WidgetBase, template, widgetTemplate, itemTemplate,
		_TemplatedMixin, Evented, project, array, ui,
		on){

	var Item = declare([_WidgetBase, _TemplatedMixin, Evented], {
		templateString: itemTemplate,

		constructor: function(){
			this.inherited(arguments);
		},

		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

			on(this.domNode, "click", function(e){
				e.stopPropagation();
				window.open(self.url, '_blank');
			});
		}
	});

	var WidgetContainer = declare([_WidgetBase, _TemplatedMixin], {
		templateString: widgetTemplate,

		constructor: function(){
			this.inherited(arguments);
		},

		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

			array.forEach(this.widgets, function(widget){
				if (widget.config && widget.config.linkurl){
					var link = new Item({
						label: widget.label,
						icon: project.config.getPath(widget.icon),
						url: widget.config.linkurl
					});
					link.placeAt(self.container);
				}
			});
		}
	});
	WidgetContainer.createNew = function(widget){
		var icon = widget.icon ? project.config.getPath(widget.icon) : "/images/folder.svg";
		
		return new WidgetContainer({
			label: widget.label,
			icon: icon,
			widgets: widget.widgets
		});
	};

	return declare("maple/widgets/Links", [_WidgetBase, _TemplatedMixin, Evented], {
		templateString: template,

		constructor: function(){
			this.inherited(arguments);

			// Get link widgets
			this.widgets = project.config.widgetcontainer.findAll("Link");
		},

		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

			array.forEach(this.widgets, function(widget){
				// Accept only groups of links (no individual links allowed)
				if (widget.category){
					var obj = WidgetContainer.createNew(widget);
					obj.placeAt(self.linksWidgets);

					ui.setMenuItemExpandable(obj.title);
				}
			});
		},

		startup: function(){
			this.inherited(arguments);

			this.emit("load", {});
		}
	});
});