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
define("maple/widgets/Bookmarks", ["dojo/_base/declare", "dijit/_WidgetBase", 
		"dojo/text!maple/widgets/Bookmarks/Bookmarks.html",
		"dojo/text!maple/widgets/Bookmarks/Bookmarks.WidgetContainer.html",
		"dijit/_TemplatedMixin",
		"dojo/Evented","maple/config/project", "dojo/_base/array", "maple/helpers/ui",
		"esri/dijit/Bookmarks", "esri/geometry/Extent", "esri/SpatialReference",
		"dojo/query", "dojo/on", "dojo/dom-class",
		"dojo/NodeList-traverse"],
function(declare, _WidgetBase, template, widgetTemplate,
		_TemplatedMixin, Evented, project, array, ui,
		BookmarksWidget, Extent, SpatialReference, 
		query, on, domClass){

	var WidgetContainer = declare([_WidgetBase, _TemplatedMixin, Evented], {
		templateString: widgetTemplate,

		constructor: function(params, srcNodeRef){
			this.inherited(arguments);
		},



		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

			var loadUserBookmarks = function(){
				var result;
				if (window.localStorage){
					var key = project.config.title + "_" + self.label;
					result = JSON.parse(window.localStorage.getItem(key));
				}
				return result || [];
			};

			var saveUserBookmarks = function(){
				if (window.localStorage){
					var key = project.config.title + "_" + self.label;
					var allBookmarks = widget.bookmarks;
					var userBookmarks = array.filter(allBookmarks, function(bookmark){
						return !bookmark.defaultBookmark;
					});
					window.localStorage.setItem(key, JSON.stringify(userBookmarks));
				}
			};

			var bookmarks = array.map(this.config.bookmarks.bookmark, function(bookmark){
				var parts = bookmark.$t.split(" ");
				var xmin = parseFloat(parts[0]),
					ymin = parseFloat(parts[1]),
					xmax = parseFloat(parts[2]),
					ymax = parseFloat(parts[3]);

				return {
					extent: new Extent(xmin, ymin, xmax, ymax, new SpatialReference({wkid: map.extent.spatialReference.wkid})),
					name: bookmark.name
				};
			});

			var widget = new BookmarksWidget({
				map: map,
				editable: true,
				bookmarks: bookmarks
			}, this.container);

			this.container.dojoClick = false;

			// Mark default bookmarks
			array.forEach(widget.bookmarks, function(bookmark){
				bookmark.defaultBookmark = true;
			});

			// Add user bookmarks
			array.forEach(loadUserBookmarks(), function(bookmark){
				widget.addBookmark(bookmark);
			});

			on(widget, 'edit', saveUserBookmarks);
			on(widget, 'remove', saveUserBookmarks);

			on(this.container, "click", function(e){
				// When user clicks on item, outside of label, make sure
				// the bookmark is still followed
				if (domClass.contains(e.target, "esriBookmarkItem")){
					e.stopPropagation();
					var label = query(e.target).children(".esriBookmarkLabel")[0];
					if (label){
						label.click(e);
					}
				}
			});

			on(this.container, "touchstart", function(e){
				// Fix a bug in ESRI's bookmark widget on mobile devices
				// (a double touch happens)
				if (domClass.contains(e.target, "esriBookmarkEditImage") || 
					domClass.contains(e.target, "esriBookmarkEditBox")|| 
					domClass.contains(e.target, "esriAddBookmark")){
					e.preventDefault(); // Prevent first touch
				}
			});
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

	return declare("maple/widgets/Bookmarks", [_WidgetBase, _TemplatedMixin], {
		templateString: template,

		constructor: function(params, srcNodeRef){
			this.inherited(arguments);

			map = params.map;

			// Get bookmark widgets
			this.widgets = project.config.widgetcontainer.findAll("Bookmark");
		},

		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

			array.forEach(this.widgets, function(widget){
				obj = WidgetContainer.createNew(widget);
				obj.placeAt(self.bookmarkWidgets);

				ui.setMenuItemExpandable(obj.title);
			});
		},

		startup: function(){
			this.inherited(arguments);

			this.emit("load", {});
		}
	});
});