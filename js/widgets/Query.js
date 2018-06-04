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
define("maple/widgets/Query", ["dojo/_base/declare", "dijit/_WidgetBase", 
		"dojo/text!maple/widgets/Query/Query.html",
		"dojo/text!maple/widgets/Query/Query.Category.html",
		"dojo/text!maple/widgets/Query/Query.Item.html",
		"dojo/text!maple/widgets/Query/Query.Search.html",
		"dojo/text!maple/widgets/Query/Query.Search.Category.html",
		"dojo/text!maple/widgets/Query/Query.Search.Category.Result.html",
		"dijit/_TemplatedMixin", "dijit/_WidgetsInTemplateMixin", 
		"maple/helpers/ui", "dojo/dom-class", "dojo/on", "dojo/has", "dojo/dom-construct", "dojo/dom-attr",
		"dojo/_base/array", "dojo/_base/lang",
		"maple/helpers/utils", "dojo/Evented", "dijit/registry", 
		"maple/config/project", "maple/config/server",
		"maple/helpers/map/infoTemplate",
		"esri/layers/FeatureLayer", "esri/symbols/PictureMarkerSymbol", 
		"esri/symbols/SimpleFillSymbol", "esri/symbols/SimpleLineSymbol",
		"esri/Color", "esri/renderers/SimpleRenderer", "esri/tasks/query",
		"jquery",
		"dojox/mobile/Button"],
function(declare, _WidgetBase, template, categoryTemplate, itemTemplate, searchTemplate, searchCategoryTemplate, searchCategoryResultTemplate, 
		_TemplatedMixin, _WidgetsInTemplateMixin,
		ui, domClass, on, has, domConstruct, domAttr, array, lang, utils, Evented, registry, project, server,
		infoTemplate, FeatureLayer, PictureMarkerSymbol, SimpleFillSymbol, SimpleLineSymbol, Color, SimpleRenderer, Query, $){

	var Category = declare([_WidgetBase, _TemplatedMixin, Evented], {
		templateString: categoryTemplate,

		constructor: function(params, srcNodeRef){
			this.inherited(arguments);
		},

		buildRendering: function(){
			this.inherited(arguments);
			this.items = [];

			var self = this;

			array.forEach(this.widgets, function(widget){
				var item = Item.createNew(widget);
				item.placeAt(self.content);
				self.items.push(item);

				// Track children clicks on the checkbox
				item.on("checkboxChanged", function(){
					var selectCount = 0;
					for (var i = 0; i < self.items.length; i++){
						if (self.items[i].checkbox.checked) selectCount++;
					}

					self.checkbox.checked = selectCount > 0;
					if (selectCount > 0 && selectCount < self.items.length) domClass.add(self.checkbox, "partial");
					else domClass.remove(self.checkbox, "partial");

					self.emit("checkboxChanged", {});
				});

			});

			on(this.checkbox, "click", function(e){ 
				// Select/Deselect all children
				array.forEach(self.items, function(item){
					item.select(self.checkbox.checked);
				});
				domClass.remove(self.checkbox, "partial");

				e.stopPropagation();

				self.emit("checkboxChanged", {});
			});
		}
	});

	var Item = declare([_WidgetBase, _TemplatedMixin, Evented], {
		templateString: itemTemplate,

		constructor: function(params, srcNodeRef){
			this.inherited(arguments);
		},

		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

			on(this.checkbox, "click", function(e){ 
				e.stopPropagation(); 
				self.emit("checkboxChanged", {}); 
			});
			on(this.item, "click", function(){
				self.checkbox.checked = !self.checkbox.checked;
				self.emit("checkboxChanged", {}); 
			});
		},

		select: function(flag){
			this.checkbox.checked = flag;
		}
	});
	Item.createNew = function(widget){
		return new Item({
			label: widget.label,
			icon: project.config.getPath(widget.icon),
			config: widget.config
		});
	};

	var Search = declare([_WidgetBase, _TemplatedMixin], {
		templateString: searchTemplate,

		constructor: function(params, srcNodeRef){
			this.inherited(arguments);
			this.activeItems = [];			

			this._filterTimeout = null;
			this._readyToSearch = false;
		},

		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

			on(this.clearSearchButton, "click", function(){ self._clearSearch(); });
			on(this.searchbox, "keyup", function(){ self._applySearchFilter(); });

			on(this.closeSearchButton, "click", function(e){
				e.stopPropagation();
				self.close();
			});
			on(this.toggleSearchButton, "click", function(e){
				e.stopPropagation();

				// On Android and fullscreen iOS, delay the toggle so that the components
				// underneath the popup do not get pressed
				if (utils.getPlatform() === "Android" || (window.navigator.standalone !== undefined && window.navigator.standalone === true)){
					setTimeout(function(){
						self.toggleCollapse();
					}, 400);
				}else{
					self.toggleCollapse();
				}	
			});

			if (has("touch")){
				// On mobile make sure that the panel pops back up when
				// we press anywhere in the top part of the panel
				on(this.searchgroup, "click", function(){
					self.expand();
				});

				// When we touch the text filter textbox, 
				// popup the keyboard before expanding
				on(this.searchbox, "click", function(e){
					e.stopPropagation();
					setTimeout(function(){
						self.expand();
					}, 600);
				});
			}
		},

		_clearSearch: function(){
			if (this._filterTimeout) clearTimeout(this._filterTimeout);
			this.searchbox.value = "";
			if (!has("touch")) this.searchbox.focus();
			domClass.remove(this.searchgroup, "hasValue");
			this.filter("");
			domClass.add(this.noResults, "hide");
		},

		_applySearchFilter: function(){
			if (!this._readyToSearch) return;

			var self = this;
			
			if (this.searchbox.value !== ""){
				domClass.add(this.searchgroup, "hasValue");

				if (this._filterTimeout) clearTimeout(this._filterTimeout);
				this._filterTimeout = setTimeout(function(){
					var count = self.filter(self.searchbox.value);
					if (count === 0){
						domClass.remove(self.noResults, "hide");
						self.noResultsKeyword.innerHTML = utils.stripTags(self.searchbox.value);
					}else{
						domClass.add(self.noResults, "hide");
					}
				}, 300);
			}else{
				this._clearSearch();
			}
		},

		_onResultsAvailable: function(){
			this._readyToSearch = true;
			if (this.searchbox.value !== ""){
				this._applySearchFilter();
			}
		},

		// @param keyword keyword to filter by, or "" to show all
		// @return number of categories shown after filtering
		filter: function(keyword){
			var self = this;
			var count = 0;

			array.forEach(this.activeItems, function(item){
				var category = registry.byId(self.getId(item.id));
				var resultsCount = category.filter(keyword);
				if (resultsCount === 0) category.hide();
				else{
					category.show();				
					count++;
				}
			});

			return count;
		},

		open: function(){
			domClass.add(this.domNode, "open");
			domClass.add(map.container, "querySearchOpen");
		},

		close: function(){
			domClass.remove(this.domNode, "open");
			domClass.remove(map.container, "querySearchOpen");
			// map.infoWindow.hide();
		},

		collapse: function(){
			this.scrollTop();
			domClass.add(this.domNode, "collapsed");
		},

		expand: function(){
			domClass.remove(this.domNode, "collapsed");
			this.restoreScrollTop();
		},

		toggleCollapse: function(){
			if (domClass.contains(this.domNode, "collapsed")){
				this.expand();
			}else{
				this.collapse();
			}
		},

		scrollTop: function(){
			this._lastScrollTop = this.domNode.scrollTop;
			this.domNode.scrollTop = 0;
		},

		// Set the scroll top to the value prior to the last
		// call to scrollTop()
		restoreScrollTop: function(){
			if (this._lastScrollTop){
				this.domNode.scrollTop = this._lastScrollTop;
			}
		},

		setActiveItems: function(items){

			// Find which items were added and which removed
			// from active list
			var added = [];
			var removed = [];
			var self = this;

			array.forEach(items, function(item){
				var found = false;

				for (var i = 0; i < self.activeItems.length; i++){
					if (self.activeItems[i] === item){
						found = true;
						break;
					}
				}

				if (!found) added.push(item);
			});

			array.forEach(self.activeItems, function(activeItem){
				var found = false;
				for (var i = 0; i < items.length; i++){
					if (items[i] === activeItem){
						found = true;
						break;
					}
				}

				if (!found) removed.push(activeItem);
			});

			this.activeItems = items;

			this.removeItems(removed);
			this.addItems(added);

			this.updateSearchPlaceholder();

			// Did we just remove all query search items?
			if (removed.length > 0 && items.length === 0){
				this._readyToSearch = false;
			}
		},

		updateSearchPlaceholder: function(){
			var searchableFields = array.filter(
						array.map(this.activeItems, function(item){
								return item.config.filterfield ? 
									   item.config.filterfield.alias : 
									   undefined;
							}),
							function filter(value){
								return value !== undefined;
							});

			domAttr.set(this.searchbox, "placeholder", 
					searchableFields.length > 0 ? 
					searchableFields.join(", ") :
					"Search"
				);
		},

		// Builds the search result DOM elements
		addItems: function(items){
			var self = this;

			array.forEach(items, function(item){
				var searchCategory = new Search.Category({
					id: self.getId(item.id),
					icon: item.icon,
					label: item.label,
					config: item.config,
					parent: self
				}, domConstruct.create("div"));
				searchCategory.queryAll();

				searchCategory.placeAt(self.queryResults);
			});
		},

		// Destroys the search result DOM elements
		removeItems: function(items){
			var self = this;

			array.forEach(items, function(item){
				registry.byId(self.getId(item.id)).destroy();
			});
		},

		// Computes a unique ID based on an item
		getId: function(id){
			return "search_query_cat_" + id;
		}
	});
	Search.Category = declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
		templateString: searchCategoryTemplate,
		widgetsInTemplate: true,

		constructor: function(){
			this.inherited(arguments);
			this.destroyed = false;

			this.searchResults = []; // Hold Search.Category.Results for this category
		},

		buildRendering: function(){
			this.inherited(arguments);
			var self = this;

			on(this.btnTryAgain, "click", function(){
				domClass.add(self.error, "hide");
				domClass.remove(self.loading, "hide");

				self.cleanup();
				self.queryAll();
			});
		},

		setFeaturesCount: function(count){
			domClass.remove(this.featuresCount, "hide");
			this.featuresCount.innerHTML = "(" + count + ")";
		},

		// @param loaded cb when layer is done loading
		addFeatureLayer: function(loaded, err){
			var config = this.config;
			var self = this;
			
			if (!this.featureLayer){
				var outFields;
				if (config.fields.all){
					outFields = ["*"];
				}else{
					outFields = array.map(config.fields.field, function(field){
						return field.name;
					});

					// Make sure the OBJECTID field is always included
					// or else we won't be able to make selections
					if (outFields.indexOf("OBJECTID") === -1) outFields.push("OBJECTID");
				}	

				this.featureLayer = new FeatureLayer(config.layer, {
					mode: FeatureLayer.MODE_SNAPSHOT,
					outFields: outFields,
					orderByFields: [config.orderbyfields ? config.orderbyfields : ""],
					definitionExpression: typeof config.query === "string" ? config.query : "",
					opacity: 1
				});

				map.addLayer(this.featureLayer); 
				this.featureLayer.on("load", loaded);
				this.featureLayer.on("error", err);
			}
		},

		// @param keyword keyword to filter by, or "" to show all
		// @return number of results
		filter: function(keyword){
			var result;
			var count = 0;
			keyword = keyword.toLowerCase();
			var objectIds = [];

			for (var i = 0; i < this.searchResults.length; i++){
				result = this.searchResults[i];
				if (keyword === "" || result.key.toLowerCase().indexOf(keyword) !== -1){
					result.show();
					objectIds.push(result.objectId);
					count++;
				}else{
					result.hide();
				}
			}
			this.setFeaturesCount(count);

			// Apply selection to layer
			// IMPROVEME: this is pinging the server
			// But shouldn't. See https://os.masseranolabs.com//dashboard#details/9a630fa3b918cb160c8fd8bad16ee5e7
			var self = this;
			this.featureLayer.clearSelection();
			var query = new Query();
			query.objectIds = objectIds;

			function generateSelectRequest(){
				var layer = self.featureLayer;

				function done(){
					delete(layer._selectInProgress);
					if (layer.processNextSelect){
						layer.processNextSelect();
						delete(layer.processNextSelect);
					}
				}

				return function(){
					layer._selectInProgress = true;
					layer.selectFeatures(query, FeatureLayer.SELECTION_NEW,
						done, done);
				};
			}

			// featureLayer.selectFeatures is async
			// so when old requests get completed after
			// newer request, we get the wrong selection.
			// So we track if a selection is in progress 
			// and defer selection after any older
			// request is completed.
			if (!this.featureLayer._selectInProgress){
				(generateSelectRequest())();
			}else{
				this.featureLayer.processNextSelect = generateSelectRequest();
			}

			return count;
		},
		
		// Find all matching records
		queryAll: function(){
			var self = this;

			this.addFeatureLayer(function(){
				infoTemplate.extractFieldsInfo(self.config.fields.field, self.featureLayer);
				self.featureLayer.setInfoTemplate(
										infoTemplate.create("${" + self.config.titlefield + "}", 
											array.filter(self.config.fields.field, function(field){
												return field.name !== self.config.titlefield;
											}),
											{
												titleType: infoTemplate.getFieldType(self.config.titlefield, self.featureLayer),
												linkField: self.config.linkfield,
												allVisible: true
											}));

				var query = new Query();
				query.where = self.config.query ? self.config.query : "1=1"; // Actually used by ESRI's viewer
				query.returnGeometry = true;
				query.returnDistinctValues = false;
				query.orderByFields = [self.config.orderbyfields ? self.config.orderbyfields : ""];

				var filterField = self.getFilterField();
				self.featureLayer.selectFeatures(query, FeatureLayer.SELECTION_NEW, function(results){
					// Make sure the widget still exists (the user could have closed it
					// while results are being fetched)
					if (self.destroyed) return;

					var geometryType;
					for (var i = 0; i < results.length; i++){
						if (results[i].geometry.type){
							geometryType = results[i].geometry.type;
							break;
						}
					}
					
					var resultIcon = self.setupLayerSymbol(geometryType) || self.icon;
					var asyncRunner = new utils.AsyncRunner(0);
					asyncRunner.runSeries(results, function(result){

						// Filter out fields that are not explicitly requested
						// (expect OBJECTID, we always need it for selecting features)
						if (self.config.fields.all === false){
							var fields = array.map(self.config.fields.field, function(field){ return field.name; });
							if (fields.indexOf("OBJECTID") === -1) fields.push("OBJECTID");
							for (var key in result.attributes){
								if (array.indexOf(fields, key) === -1){
									delete(result.attributes[key]);
								}
							}
						}

						var title = result.getTitle();
						var content = result.getContent();
						var icon = resultIcon;

						// Handle case when the titlefield is the only field displayed
						// don't display it twice
						if (self.config.fields.field.length === 1 && self.config.fields.field[0].name === self.config.titlefield){
							content = "";
						}

						var symbol = self.featureLayer.getSelectionSymbol();
						if (symbol.type === "simplefillsymbol"){
							if (geometryType === "polyline"){
								icon = "/images/simple-line.svg";
							}else{
								icon = "/images/square-area.svg";
							}
						}else if (symbol.style === "solid"){
							icon = {color: symbol.color, url: "/images/simple-line.svg"};
						}

						// Display results
						var searchResult = new Search.Category.Result({
							icon: icon,
							text: "<div class='title'>" + title + "</div>" + content,
							key: result.attributes[filterField] ? result.attributes[filterField].toString() : "",
							objectId: result.attributes[self.featureLayer.objectIdField]
						}, domConstruct.create("div"));

						searchResult.placeAt(self.results);
						self.searchResults.push(searchResult);

						// Handle selection to map
						searchResult.on("click", function(){

							// On mobile, if the menu is still open
							// do not select the item as the user
							// might be trying to close the menu by touching
							if (has("touch") && sideMenu.isOpen()) return;

							// Zoom to the selected feature
							function showInfoWindow(){
								map.infoWindow.setFeatures([result]); // Highlight
								map.infoWindow.show(center, map.getInfoWindowAnchor(center), {hideZoom: true});
								map.infoWindow.setTitle(title);
								map.infoWindow.setContent(content);
							}
							
							var expandBy = 5.0; // Use it to control zoom level
							var extent;
							var center;

							switch(result.geometry.type){
								case "point":
									center = result.geometry;
									break;
								case "extent":
									extent = result.geometry.expand(expandBy);
									break;
								case "polygon":
								case "multipoint":
								case "polyline":
									extent = result.geometry.getExtent().expand(expandBy);
									break;
							}

							var centerAndShowInfoWindow = function(){
								if (extent) {
									map.setExtent(extent).then(function(){
										center = extent.getCenter();
										showInfoWindow();
									});
								}else{
									map.centerAt(center)
										.then(function(){
											map.setScale(parseInt(self.config.zoomscale) || 6000)
												.then(showInfoWindow);
										});
								}
							};
							centerAndShowInfoWindow();

							// Hack to fix a display issue https://os.masseranolabs.com//dashboard#details/bae3ded6dc673faddf89186b72d30cd4
							// on the first selection, the map does not properly center all of the times.
							// Calling centerAndShowInfoWindow again after a short delay seems to fix it.
							// It seems that something is not properly initialized, but seems ESRI's fault
							// as we are respecting the Deferred calls.
							if (!self.__firstSelection){
								setTimeout(centerAndShowInfoWindow, 400);
								self.__firstSelection = true;
							}

							// On mobile, collapse on select
							if (has("touch")){
								self.parent.collapse();
							}
						});
					}, function(){
						self.setFeaturesCount(self.searchResults.length);

						$(self.loading).slideUp(200, function(){
							domClass.add(self.loading, "hide");
							domAttr.remove(self.loading, 'display');
						});
						
						// Force redraw on list
						// after it has been populated
						// to fix a scroll issue on iOS
						if (has("touch")){
							utils.redrawDom(self.parent.domNode);
						}

						// Notify parent
						self.parent._onResultsAvailable();
					});
				}, function(err){
					self.displayLoadError();
				});
			}, function(e){
				// Failed to add layer
				// Some errors are not load errors
				if (!/Unable to draw graphic/.test(e.error.message)){
					self.displayLoadError();
				}
			});
		},

		displayLoadError: function(){
			var self = this;

			domClass.add(this.loading, "hide");
			domClass.remove(this.error, "hide");
			this.errorMessage.innerHTML = "Could not retrieve the results. Check your internet connection and try again. If the error persists, <a href='mailto:" + server.supportEmail + "'>contact support</a>.";
		},

		setupLayerSymbol: function(geometryType){
			// Setup symbols for layer
			var config = this.config;
			var symbol;
			var defaults = {
				width: 20,
				height: 20,
				icon: this.icon,
				fillColor: new Color([235, 30, 30, 0.5]),
				strokeColor: new Color([235, 30, 30, 0.75]),
				strokeWidth: 2
			};
			var	width, height;
			var newIcon = "";

			if (config.symbols){
				if (config.symbols.picturemarkersymbol){
					width = defaults.width;
					height = defaults.height;
					var icon = defaults.icon;
					
					if (config.symbols.picturemarkersymbol.length && this.config.symbols.picturemarkersymbol.length >= 2){
						height = config.symbols.picturemarkersymbol[0].height;
						width = config.symbols.picturemarkersymbol[1].width;
					}

					if (config.symbols.picturemarkersymbol.url){
						icon = project.config.getPath(config.symbols.picturemarkersymbol.url);
						newIcon = icon;
					}

					symbol = createPictureSymbol(icon, width, height);
					this.featureLayer.setRenderer(new SimpleRenderer(symbol));
				}else if (config.symbols.simplelinesymbol){
					var alpha = 1;
					var color = new Color([255, 255, 255, alpha]);
					width = 4;
					if (config.symbols.simplelinesymbol.color){
						var color32 = config.symbols.simplelinesymbol.color;
						var r = (color32 >> 16) & 0xFF,
							g = (color32 >> 8) & 0xFF,
							b = color32 & 0xFF;
						color = new Color([r, g, b, alpha]);
					}
					if (config.symbols.simplelinesymbol.width) width = config.symbols.simplelinesymbol.width;

					symbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, color, width);
				}else{
					console.warn("No symbol found for query: ", config);
				}
			}else if (geometryType === "point"){
				symbol = createPictureSymbol(defaults.icon, defaults.width, defaults.height);
				this.featureLayer.setRenderer(new SimpleRenderer(symbol));
			}else if (geometryType === "polyline"){
				symbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, defaults.strokeColor, defaults.strokeWidth);
			}else{
				symbol = new SimpleFillSymbol()
					.setColor(defaults.fillColor)
					.setOutline(new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, defaults.strokeColor, defaults.strokeWidth));
			}

			this.featureLayer.setSelectionSymbol(symbol);
			return newIcon;
		},

		show: function(){
			domClass.remove(this.domNode, "hide");
		},

		hide: function(){
			domClass.add(this.domNode, "hide");
		},

		// Fallback on title if no filter is specified
		getFilterField: function(){
			return this.config.filterfield ? 
					this.config.filterfield.name || this.config.titlefield : 
					this.config.titlefield;
		},

		cleanup: function(){
			if (this.featureLayer){
				map.removeLayer(this.featureLayer);
				delete(this.featureLayer);
			}

			array.forEach(this.searchResults, function(searchResult){
				searchResult.destroy();
			});
		},

		destroy: function(){
			this.inherited(arguments);
			this.cleanup();
			this.destroyed = true;
		},
	});
	Search.Category.Result = declare([_WidgetBase, _TemplatedMixin], {
		templateString: searchCategoryResultTemplate,

		buildRendering: function(){
			this.inherited(arguments);

			// Setup icon
			if (typeof this.icon === "object"){
				var icon = this.icon;

				if (icon.url){
					// Don't use src attr
					this.iconDom.src = "";

					// Use masking instead
					this.iconDom.style.mask = this.iconDom.style["-webkit-mask"] = "url(" + icon.url + ") center / contain no-repeat";
					this.iconDom.style.backgroundColor = icon.color.toHex();
				}
			}
		},

		show: function(){
			domClass.remove(this.domNode, "hide");
		},

		hide: function(){
			domClass.add(this.domNode, "hide");
		}
	});

	// Make map and sidemenu accessible to submodules
	// Better option than bubbling down a reference
	var map;
	var sideMenu;

	// Helpers
	function createPictureSymbol(url, width, height) {
		return new PictureMarkerSymbol(
			{
				url: url,  
				width: width, 
				height: height
			});
	}

	return declare("maple/widgets/Query", [_WidgetBase, _TemplatedMixin, Evented], {
		templateString: template,

		constructor: function(params, srcNodeRef){
			this.inherited(arguments);

			// Share map, sidemenu
			map = params.map;
			sideMenu = params.sideMenu;

			// Get query widgets
			this.items = project.config.widgetcontainer.findAll("Query");
		},

		buildRendering: function(){
			this.inherited(arguments);
			this.categories = [];
			this.itemsWithoutCategory = [];
			var self = this;

			this.search = new Search({}, this.searchQuery);

			array.forEach(this.items, function(item){
				var obj;

				if (item.category){
					obj = new Category({
						label: item.label,
						icon: project.config.getPath(item.icon),
						widgets: item.widgets
					});
					self.categories.push(obj);
					
					// Handle open close of categories
					ui.setMenuItemExpandable(obj);
				}else{
					// Widget item without parent/category
					obj = Item.createNew(item);
					self.itemsWithoutCategory.push(obj);
					domClass.remove(obj.domNode, "subitem");
				}

				obj.placeAt(self.categoriesList);
				
				// Listen for checkbox changes
				obj.on("checkboxChanged", function(){
					if (self.areItemsChecked()) self.search.open();
					else self.search.close();

					self.search.setActiveItems(self.getCheckedItems());
				});
			});
		},

		startup: function(){
			this.inherited(arguments);

			this.emit("load", {});
		},

		getCheckedItems: function(){
			var checkedItems = [];

			array.forEach(this.categories, function(category){
				array.forEach(category.items, function(item){
					if (item.checkbox.checked){
						checkedItems.push(item);
					}
				});
			});

			array.forEach(this.itemsWithoutCategory, function(item){
				if (item.checkbox.checked){
					checkedItems.push(item);
				}
			});

			return checkedItems;
		},

		areItemsChecked: function(){
			return this.getCheckedItems().length > 0;
		}
	});
});