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
define(["maple/config/project", "dojo/dom-construct", 
	"dojo/_base/array", "dojo/_base/lang", "dojo/on", "dojo/query", "dojo/has",
	"dojo/dom-class", "maple/helpers/utils"], 
	function(project, domConstructor, array, lang, on, query, has, 
		domClass, utils){
	"use strict";
		return {
			buildRoleSelector: function(opts){
				opts = lang.mixin({
					id: 'profileSelector',
					container: 'profileSelectorContainer'
				}, opts);
				var profileSelector = domConstructor.create("select", {id: opts.id}, opts.container);
				array.forEach(project.get("config.widgets.ConfigSelectSplash.ConfigSelectSplashWidget.userroles.userrole", []), function(role){
					var configFile = role.configfile.replace(/\.xml$/i, ".json");
					var option = domConstructor.create("option", 
						{
							innerHTML: role.username, 
							value: configFile,
							selected: configFile === project.config.loadedConfiguration
						}, profileSelector);
				});
				return profileSelector;
			},

			setMenuItemExpandable: function(obj){
				if (obj.domNode !== undefined) obj = obj.domNode;

				on(obj, "click", function(e){
					var item = query(e.target).closest(".item")[0];
					if (item){
						if (domClass.contains(item, "item")){
							domClass.toggle(item, "open");
						}
					}
				});
			},

			setupSearchBox: function(opts){
				function SearchBox(opts){
					var self = this;

					if (!opts.searchgroup) throw new Error("Missing searchgroup");
					if (!opts.clearSearchButton) throw new Error("Missing clearSearchButton");
					if (!opts.searchbox) throw new Error("Missing searchbox");
					if (!opts.hintsNode) throw new Error("Missing hintsNode");
					if (!opts.hints) throw new Error("Missing hints");

					for (var k in opts){
						this[k] = opts[k];
					}
					this.filterTimeout = null;
					this.results = {};
					this.enterPressed = false;
					this.itemSelected = false;
					this.highlightedHintIndex = -1;
					this.lastKeywordSearch = "";

					on(this.clearSearchButton, "click", function(){
						self.clearSearch();
					});
					on(this.searchbox, "keyup", function(e){
						if (self.searchbox.value !== ""){
							var key = e.which || e.charCode || e.keyCode;

							// Enter
							if (key === 13){
								self.searchButtonPressed();
							}else if (key === 40){
								self.downArrowPresssed();
								e.stopPropagation();
							}else if (key === 38){
								self.upArrowPresssed();
								e.stopPropagation();
							}else{
								domClass.add(self.searchgroup, "hasValue");
								self.itemSelected = false;

								if (self.filterTimeout) clearTimeout(self.filterTimeout);
								self.clearResults();
								self.hideNoResults();
								self.enterPressed = false;
								self.filterTimeout = setTimeout(function(){
									if (self.onTextChanged) self.onTextChanged(self.searchbox.value);
									self.retrieveHints();
								}, 300);
							}
						}else{
							self.clearSearch();
						}
					});
					if (self.searchButton){
						on(self.searchButton, "click", function(){
							self.searchButtonPressed();
						});
					}
				}

				SearchBox.prototype.clearSearch = function(){
					if (this.filterTimeout) clearTimeout(this.filterTimeout);
					this.searchbox.value = "";
					this.lastKeywordSearch = "";
					this.itemSelected = false;
					this.hideSpinner();
					if (!has("touch")) this.searchbox.focus();
					domClass.remove(this.searchgroup, "hasValue");
					this.clearResults();
					this.hideNoResults();
					if (this.onClearSearch) this.onClearSearch();
				};

				SearchBox.prototype.retrieveHints = function(){
					if (this.hints){
						this.clearResults();
						this.lastKeywordSearch = this.searchbox.value;
						this.hints(this.searchbox.value);
					}
				};

				SearchBox.prototype.hideHints = function(){
					this.highlightedHintIndex = -1;
					this.hideError();
					this.hintsNode.innerHTML = "";
				};

				SearchBox.prototype.clearResults = function(){
					this.hideHints();
					for (var i in this.results){
						for (var j in this.results[i].hints){
							domConstructor.destroy(this.results[i].hints[j].dom);
						}
					}
					this.results = {};
				};

				SearchBox.prototype.upArrowPresssed = function(){
					if (--this.highlightedHintIndex < 0) this.highlightedHintIndex = 0;
					this.highlightHint();
				};

				SearchBox.prototype.downArrowPresssed = function(){
					if (++this.highlightedHintIndex > this.getResults().hints.length - 1) this.highlightedHintIndex = this.getResults().hints.length - 1;
					this.highlightHint();
				};

				SearchBox.prototype.highlightHint = function(){
					var results = this.getResults();

					array.forEach(results.hints, function(hint){
						domClass.remove(hint.dom, "highlighted");
					});
					if (results.hints[this.highlightedHintIndex]){
						domClass.add(results.hints[this.highlightedHintIndex].dom, "highlighted");
					}
				};

				SearchBox.prototype.getResults = function(keyword){
					keyword = keyword !== undefined ? keyword : this.lastKeywordSearch;

					return this.results[this.lastKeywordSearch] ? this.results[this.lastKeywordSearch] : {hints: [], retrieved: false};
				};

				SearchBox.prototype.searchButtonPressed = function(){
					this.showSpinner();
					this.lastKeywordSearch = this.searchbox.value;
					var results = this.getResults();
					var hints = results.hints;
				
					if (hints.length > 0){
						if (this.highlightedHintIndex !== -1){
							this.selectHint(this.highlightedHintIndex);
						}else{
							this.selectHint(0);	
						}
						this.enterPressed = false;
						this.hideSpinner();
					}else {
						if (!results.retrieved){
							this.enterPressed = true;
							this.hideNoResults();
							this.clearResults();
							this.retrieveHints();
						}else{
							this.showNoResults();
							this.enterPressed = false;
						}
					}
				};

				SearchBox.prototype.showSpinner = function(){
					domClass.add(this.searchgroup, "isSearching");
				};

				SearchBox.prototype.hideSpinner = function(){
					domClass.remove(this.searchgroup, "isSearching");
				};

				SearchBox.prototype.showError = function(msg){
					this.enterPressed = false;
					this.hideHints();
					this.hideSpinner();

					if (this.error && this.errorMessage){
						this.errorMessage.innerHTML = msg;
						domClass.remove(this.error, "hide");
					}
				};

				SearchBox.prototype.hideError = function(){
					if (this.error){
						domClass.add(this.error, "hide");
					}
				};

				SearchBox.prototype.showNoResults = function(){
					this.hideSpinner();
					if (this.noResults && this.noResultsKeyword && this.enterPressed){
						this.hideHints();
						this.noResultsKeyword.innerHTML = utils.removeTags(this.searchbox.value);
						domClass.remove(this.noResults, "hide");
					}
				};

				SearchBox.prototype.hideNoResults = function(){
					if (this.noResults){
						domClass.add(this.noResults, "hide");
					}
				};

				SearchBox.prototype.addHint = function(label, value, keyword){
					var domResult = domConstructor.toDom('<div class="hintResult">' + label + '</div>');
					domConstructor.place(domResult, this.hintsNode);
					var self = this;

					on(domResult, "click", function(){
						self.selectHint(value, label);
					});

					this.results[keyword] = this.getResults(keyword);
					this.results[keyword].hints.push({dom: domResult, value: value});
				};

				SearchBox.prototype.selectHint = function(valueOrIndex, label){
					var self = this;

					function doSelect(value, label){
						if (self.onSelectHint) self.onSelectHint(value, label);
						self.hideHints();
						self.itemSelected = true;
					}		

					if (typeof valueOrIndex === "object"){
						doSelect(valueOrIndex, label);
					}else if (typeof valueOrIndex === "number"){
						var hints = this.getResults().hints;
						if (hints[valueOrIndex]){
							doSelect(hints[valueOrIndex].value, hints[valueOrIndex].dom.innerHTML);
						}
					}
				};

				SearchBox.prototype.onHintsRetrieved = function(keyword){
					// Ignore results if the search key changed in the meanwhile
					var results = this.getResults(keyword);
					results.retrieved = true;

					if (this.enterPressed){
						if (results.hints.length > 0){
							this.selectHint(0);
						}else{
							this.showNoResults();
						}
						this.enterPressed = false;
						this.hideSpinner();
					}
					if (this.itemSelected){
						this.hideHints();
					}
				};

				return new SearchBox(opts);
			}
		};
	}
);