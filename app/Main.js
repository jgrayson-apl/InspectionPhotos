/*
  Copyright 2017 Esri

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.​
*/

define([
  "calcite",
  "dojo/_base/declare",
  "ApplicationBase/ApplicationBase",
  "dojo/i18n!./nls/resources",
  "ApplicationBase/support/itemUtils",
  "ApplicationBase/support/domHelper",
  "dojo/on",
  "dojo/query",
  "dojo/dom",
  "dojo/dom-class",
  "dojo/dom-construct",
  "esri/identity/IdentityManager",
  "dojo/Deferred",
  "esri/core/Evented",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/portal/Portal",
  "esri/Graphic",
  "esri/Map",
  "esri/views/SceneView",
  "esri/layers/Layer",
  "esri/geometry/Extent",
  "esri/geometry/Mesh",
  "esri/widgets/Feature",
  "esri/widgets/Home",
  "esri/widgets/Search",
  "esri/widgets/LayerList",
  "esri/widgets/Legend",
  "esri/widgets/Print",
  "esri/widgets/ScaleBar",
  "esri/widgets/Compass",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand"
], function (calcite, declare, ApplicationBase, i18n, itemUtils, domHelper,
             on, query, dom, domClass, domConstruct,
             IdentityManager, Deferred, Evented, watchUtils, promiseUtils, Portal, Graphic,
             EsriMap, SceneView, Layer, Extent, Mesh,
             Feature, Home, Search, LayerList, Legend, Print, ScaleBar, Compass, BasemapGallery, Expand) {

  return declare([Evented], {

    /**
     *
     */
    constructor: function () {
      this.CSS = {
        loading: "configurable-application--loading",
        NOTIFICATION_TYPE: {
          MESSAGE: "alert alert-blue animate-in-up is-active inline-block",
          SUCCESS: "alert alert-green animate-in-up is-active inline-block",
          WARNING: "alert alert-yellow animate-in-up is-active inline-block",
          ERROR: "alert alert-red animate-in-up is-active inline-block"
        },
      };
      this.base = null;
      calcite.init();
    },

    /**
     *
     * @param base
     */
    init: function (base) {
      if(!base) {
        console.error("ApplicationBase is not defined");
        return;
      }
      domHelper.setPageLocale(base.locale);
      domHelper.setPageDirection(base.direction);

      this.base = base;
      const config = base.config;
      const results = base.results;
      const find = config.find;
      const marker = config.marker;

      const allMapAndSceneItems = results.webMapItems.concat(results.webSceneItems);
      const validMapItems = allMapAndSceneItems.map(function (response) {
        return response.value;
      });

      const firstItem = validMapItems[0];
      if(!firstItem) {
        console.error("Could not load an item to display");
        return;
      }
      config.title = (config.title || itemUtils.getItemTitle(firstItem));
      domHelper.setPageTitle(config.title);

      const viewProperties = itemUtils.getConfigViewProperties(config);
      viewProperties.container = "view-container";

      const portalItem = this.base.results.applicationItem.value;
      const appProxies = (portalItem && portalItem.appProxies) ? portalItem.appProxies : null;

      itemUtils.createMapFromItem({ item: firstItem, appProxies: appProxies }).then((map) => {
        viewProperties.map = map;
        itemUtils.createView(viewProperties).then((view) => {
          itemUtils.findQuery(find, view).then(() => {
            itemUtils.goToMarker(marker, view).then(() => {
              domClass.remove(document.body, this.CSS.loading);
              this.viewReady(config, firstItem, view);
            });
          });
        });
      });
    },

    /**
     *
     * @param config
     * @param item
     * @param view
     */
    viewReady: function (config, item, view) {

      // TITLE //
      dom.byId("app-title-node").innerHTML = config.title;

      // MAP DETAILS //
      this.displayMapDetails(item);

      // LOADING //
      const updating_node = domConstruct.create("div", { className: "view-loading-node loader" });
      domConstruct.create("div", { className: "loader-bars" }, updating_node);
      domConstruct.create("div", { className: "loader-text font-size--3 text-white", innerHTML: "Updating..." }, updating_node);
      view.ui.add(updating_node, "bottom-right");
      watchUtils.init(view, "updating", (updating) => {
        domClass.toggle(updating_node, "is-active", updating);
      });

      // PANEL TOGGLE //
      /* if(query(".pane-toggle-target").length > 0) {
         const panelToggleBtn = domConstruct.create("div", { className: "panel-toggle icon-ui-left-triangle-arrow icon-ui-flush font-size-1", title: "Toggle Left Panel" }, view.root);
         on(panelToggleBtn, "click", () => {
           domClass.toggle(panelToggleBtn, "icon-ui-left-triangle-arrow icon-ui-right-triangle-arrow");
           query(".pane-toggle-target").toggleClass("hide");
           query(".pane-toggle-source").toggleClass("column-18 column-24");
         });
       }*/

      // USER SIGN IN //
      this.initializeUserSignIn(view).always(() => {

        // POPUP DOCKING OPTIONS //
        /*view.popup.dockEnabled = true;
        view.popup.dockOptions = {
          buttonEnabled: false,
          breakpoint: false,
          position: "bottom-right"
        };*/

        // SEARCH //
        const search = new Search({ view: view, searchTerm: this.base.config.search || "" });
        view.ui.add(search, { position: "top-left", index: 0 });

        // HOME //
        const homeWidget = new Home({ view: view });
        view.ui.add(homeWidget, { position: "top-left", index: 1 });

        // BASEMAPS //
        const basemapGalleryExpand = new Expand({
          view: view,
          content: new BasemapGallery({ view: view }),
          expandIconClass: "esri-icon-basemap",
          expandTooltip: "Basemap"
        });
        view.ui.add(basemapGalleryExpand, { position: "top-left", index: 4 });

        // MAP VIEW ONLY //
        if(view.type === "2d") {
          // SNAP TO ZOOM //
          view.constraints.snapToZoom = false;

          // COMPASS //
          const compass = new Compass({ view: view });
          view.ui.add(compass, { position: "top-left", index: 5 });

          // PRINT //
          const print = new Print({
            view: view,
            printServiceUrl: (config.helperServices.printTask.url || this.base.portal.helperServices.printTask.url),
            templateOptions: { title: config.title, author: this.base.portal.user ? this.base.portal.user.fullName : "" }
          }, "print-node");
          this.updatePrintOptions = (title, author, copyright) => {
            print.templateOptions.title = title;
            print.templateOptions.author = author;
            print.templateOptions.copyright = copyright;
          };
          this.on("portal-user-change", () => {
            this.updatePrintOptions(config.title, this.base.portal.user ? this.base.portal.user.fullName : "");
          });
        } else {
          domClass.add("print-action-node", "hide");
        }

        // PLACES //
        this.initializePlaces(view, "Field 360 Imagery");

        //
        // LAYER LIST //
        //
        // CREATE OPACITY NODE //
        const createOpacityNode = (item, parent_node) => {
          const opacity_node = domConstruct.create("div", { className: "opacity-node esri-widget", title: "Layer Opacity" }, parent_node);
          // domConstruct.create("span", { className: "font-size--3", innerHTML: "Opacity:" }, opacity_node);
          const opacity_input = domConstruct.create("input", { className: "opacity-input", type: "range", min: 0, max: 1.0, value: item.layer.opacity, step: 0.01 }, opacity_node);
          on(opacity_input, "input", () => {
            item.layer.opacity = opacity_input.valueAsNumber;
          });
          item.layer.watch("opacity", (opacity) => {
            opacity_input.valueAsNumber = opacity;
          });
          opacity_input.valueAsNumber = item.layer.opacity;
          return opacity_node;
        };
        // CREATE TOOLS NODE //
        const createToolsNode = (item, parent_node) => {
          // TOOLS NODE //
          const tools_node = domConstruct.create("div", { className: "opacity-node esri-widget" }, parent_node);

          // REORDER //
          const reorder_node = domConstruct.create("div", { className: "inline-block" }, tools_node);
          const reorder_up_node = domConstruct.create("button", { className: "btn-link icon-ui-up", title: "Move layer up..." }, reorder_node);
          const reorder_down_node = domConstruct.create("button", { className: "btn-link icon-ui-down", title: "Move layer down..." }, reorder_node);
          on(reorder_up_node, "click", () => {
            view.map.reorder(item.layer, view.map.layers.indexOf(item.layer) + 1);
          });
          on(reorder_down_node, "click", () => {
            view.map.reorder(item.layer, view.map.layers.indexOf(item.layer) - 1);
          });

          // REMOVE LAYER //
          const remove_layer_node = domConstruct.create("button", { className: "btn-link icon-ui-close right", title: "Remove layer from map..." }, tools_node);
          on.once(remove_layer_node, "click", () => {
            view.map.remove(item.layer);
            this.emit("layer-removed", item.layer);
          });

          // ZOOM TO //
          const zoom_to_node = domConstruct.create("button", { className: "btn-link icon-ui-zoom-in-magnifying-glass right", title: "Zoom to Layer" }, tools_node);
          on(zoom_to_node, "click", () => {
            view.goTo(item.layer.fullExtent);
          });

          // LAYER DETAILS //
          const itemDetailsPageUrl = `${this.base.portal.url}/home/item.html?id=${item.layer.portalItem.id}`;
          domConstruct.create("a", { className: "btn-link icon-ui-description icon-ui-blue right", title: "View details...", target: "_blank", href: itemDetailsPageUrl }, tools_node);

          return tools_node;
        };
        // LAYER LIST //
        const layerList = new LayerList({
          view: view,
          listItemCreatedFunction: (evt) => {
            let item = evt.item;
            if(item.layer && item.layer.portalItem) {

              // CREATE ITEM PANEL //
              const panel_node = domConstruct.create("div", { className: "esri-widget" });

              // LAYER TOOLS //
              createToolsNode(item, panel_node);

              // OPACITY //
              createOpacityNode(item, panel_node);

              // if(item.layer.type === "imagery") {
              //   this.configureImageryLayer(view, item.layer, panel_node);
              // }

              // LEGEND //
              if(item.layer.legendEnabled) {
                const legend = new Legend({ container: panel_node, view: view, layerInfos: [{ layer: item.layer }] })
              }

              // SET ITEM PANEL //
              item.panel = {
                title: "Settings",
                className: "esri-icon-settings",
                content: panel_node
              };
            }
          }
        });
        const layerListExpand = new Expand({
          view: view,
          content: layerList,
          expandIconClass: "esri-icon-layer-list",
          expandTooltip: "Layer List"
        });
        view.ui.add(layerListExpand, { position: "top-right", index: 0 });

        this.initializeInspectionPhotos(view);

      });

    },


    /**
     *
     * @param view
     */
    initializeInspectionPhotos: function (view) {

      const fieldVisitRecordsLayer = view.map.layers.find(layer => {
        return (layer.title === "Non Facility June Field Visit Records");
      });
      fieldVisitRecordsLayer.load().then(() => {

        this.initializeSpherePanel(view);

        view.popup.watch("selectedFeature", selectedFeature => {
          dom.byId("photos-list").innerHTML = "";
          if(selectedFeature) {
            fieldVisitRecordsLayer.queryFeatureAttachments(selectedFeature).then(attachmentInfos => {
              this.displayAttachmentsList(selectedFeature, attachmentInfos);
            });
          }
        });

        view.map.add(fieldVisitRecordsLayer);
      });
      //});

    },

    /**
     *
     * @param selectedFeature
     * @param attachmentInfos
     */
    displayAttachmentsList: function (selectedFeature, attachmentInfos) {

      dom.byId("photo-count").innerHTML = attachmentInfos.length;

      const photos_list = dom.byId("photos-list");

      attachmentInfos.forEach(attachmentInfo => {
        if(this.contentIsImage(attachmentInfo.contentType)) {

          const attachment_info_node = domConstruct.create("div", { className: "side-nav-link btn-disabled" }, photos_list);

          domConstruct.create("div", { className: "photo-preview-name font-size-0", innerHTML: attachmentInfo.name }, attachment_info_node);

          const attachment_img = domConstruct.create("img", {
            className: "photo-preview",
            src: attachmentInfo.url,
            crossOrigin: "anonymous"
          }, attachment_info_node);

          attachment_img.onload = () => {
            domClass.remove(attachment_info_node, "btn-disabled");

            on(attachment_img, "click", () => {
              this.getFlippedImageCanvas(attachment_img).then(canvas => {
                this.setSphereLocation(selectedFeature.geometry.clone(), canvas);
              });
            });
          };

        } else {
          console.warn("Non-image attachment: ", attachmentInfo.contentType, attachmentInfo);
        }
      });

    },

    /**
     *
     * @param contentType
     * @returns {boolean}
     */
    contentIsImage: function (contentType) {
      const content_info = contentType.split("/");
      const type = content_info[0];
      const subtype = content_info[(content_info.length > 1) ? 1 : 0];
      return ((type === "image") || (["gif", "jpeg", "jpg", "png", "svg+xml"].includes(subtype)));
    },

    /**
     *
     * @param image
     */
    getFlippedImageCanvas: function (image) {
      const deferred = new Deferred();

      const canvas = domConstruct.create("canvas", {});
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        ctx.scale(-1, 1);
        ctx.drawImage(img, -img.naturalWidth, 0, img.naturalWidth, img.naturalHeight);

        deferred.resolve(canvas);
      };
      img.crossOrigin = image.crossOrigin;
      img.src = image.src;

      return deferred.promise;
    },

    /**
     *
     */
    initializeSpherePanel: function (view) {

      const sphere_container = dom.byId("sphere-container");

      // SPHERE VIEW //
      const sphere_view = new SceneView({
        container: sphere_container,
        map: new EsriMap({ basemap: "satellite" }),
        ui: { components: [] }
      });
      return sphere_view.when(() => {

        domClass.add(sphere_view.container, "hide");

        this.displaySphereView = () => {
          domClass.add(view.container, "hide");
          domClass.remove(sphere_view.container, "hide");
        };

        this.hideSphereView = () => {
          domClass.add(sphere_view.container, "hide");
          domClass.remove(view.container, "hide");
        };


        // BACK TO TOP //
        const back_btn = domConstruct.create("div", {
          id: "close-view-btn",
          className: "icon-ui-close icon-ui-flush icon-ui-red font-size-5 esri-widget--button",
          title: "Back to Map"
        });
        sphere_view.ui.add(back_btn, "top-right");
        on(back_btn, "click", () => {
          this.hideSphereView();
        });


        // VIEW CAMERA HEADING //
        this.createHeadingSlider(sphere_view);

        // CAMERA POSITION NAVIGATION //
        this.setCameraPositionNavigation(sphere_view);


        // SPHERE SIZE //
        const sphere_size_meters = 1000.0;

        /**
         * SET SPHERE LOCATION
         *
         * @param location
         * @param image
         */
        this.setSphereLocation = (location, image) => {

          sphere_view.graphics.removeAll();
          const sphere_graphic = new Graphic({
            geometry: Mesh.createSphere(location.clone(), {
              size: sphere_size_meters,
              densificationFactor: 2,
              material: { color: image }
            }),
            symbol: {
              type: "mesh-3d",
              symbolLayers: [{ type: "fill" }]
            }
          });
          sphere_view.graphics.add(sphere_graphic);

          location.z = (sphere_size_meters * 0.5);

          sphere_view.goTo({ position: location, heading: 0.0, tilt: 90.0 }, { animate: false }).then(() => {
            sphere_view.focus();
            this.displaySphereView();
          });
        };

        /*let positionGraphic = new Graphic({
          geometry: sphere_view.camera.position.clone(),
          symbol: {
            type: "picture-marker",
            url: "./assets/icon108.png",
            width: "24px",
            height: "24px",
            angle: sphere_view.camera.heading
          }
        });
        view.graphics.add(positionGraphic);
        const updatePositionGraphic = (camera) => {
          view.graphics.remove(positionGraphic);
          positionGraphic = positionGraphic.clone();
          positionGraphic.geometry = camera.position.clone();
          positionGraphic.symbol.angle = camera.heading;
          view.graphics.add(positionGraphic);
        };
        */

        return sphere_view;
      });

    },

    /**
     *
     * @param view
     */
    setCameraPositionNavigation: function (view) {

      //
      // B + Left-click + Drag //
      //

      view.on("immediate-click", function (evt) {
        evt.stopPropagation();
      });
      view.on("click", function (evt) {
        evt.stopPropagation();
      });
      view.on("double-click", function (evt) {
        evt.stopPropagation();
      });
      // DRAG //
      view.inputManager._inputManager._activeKeyModifiers = new Set(["b"]);
      view.on("drag", ["b"], function (evt) {
        // LEFT CLICK //
        if(evt.button !== 0) {
          evt.stopPropagation();
        }
      });
      view.on("hold", function (evt) {
        evt.stopPropagation();
      });
      view.on("key-down", function (evt) {
        evt.stopPropagation();
      });
      view.on("key-up", function (evt) {
        evt.stopPropagation();
      });
      view.on("mouse-wheel", function (evt) {
        evt.stopPropagation();
      });
      view.on("pointer-down", function (evt) {
        evt.stopPropagation();
      });
      view.on("pointer-enter", function (evt) {
        view.container.style.cursor = "all-scroll";
        evt.stopPropagation();
      });
      view.on("pointer-leave", function (evt) {
        view.container.style.cursor = "default";
        evt.stopPropagation();
      });
      view.on("pointer-move", function (evt) {
        evt.stopPropagation();
      });
      view.on("pointer-up", function (evt) {
        evt.stopPropagation();
      });

    },


    /**
     * DISPLAY MAP DETAILS
     *
     * @param portalItem
     */
    displayMapDetails: function (portalItem) {

      const itemLastModifiedDate = (new Date(portalItem.modified)).toLocaleString();

      dom.byId("current-map-card-thumb").src = portalItem.thumbnailUrl;
      dom.byId("current-map-card-thumb").alt = portalItem.title;
      dom.byId("current-map-card-caption").innerHTML = `A map by ${portalItem.owner}`;
      dom.byId("current-map-card-caption").title = "Last modified on " + itemLastModifiedDate;
      dom.byId("current-map-card-title").innerHTML = portalItem.title;
      dom.byId("current-map-card-title").href = `https://www.arcgis.com/home/item.html?id=${portalItem.id}`;
      dom.byId("current-map-card-description").innerHTML = portalItem.description;

    },

    /**
     *
     * @returns {*}
     */
    initializeUserSignIn: function (view) {

      const checkSignInStatus = () => {
        return IdentityManager.checkSignInStatus(this.base.portal.url).then(userSignIn);
      };
      IdentityManager.on("credential-create", checkSignInStatus);
      IdentityManager.on("credential-destroy", checkSignInStatus);

      // SIGN IN NODE //
      const signInNode = dom.byId("sign-in-node");
      const userNode = dom.byId("user-node");

      // UPDATE UI //
      const updateSignInUI = () => {
        if(this.base.portal.user) {
          dom.byId("user-firstname-node").innerHTML = this.base.portal.user.fullName.split(" ")[0];
          dom.byId("user-fullname-node").innerHTML = this.base.portal.user.fullName;
          dom.byId("username-node").innerHTML = this.base.portal.user.username;
          dom.byId("user-thumb-node").src = this.base.portal.user.thumbnailUrl;
          domClass.add(signInNode, "hide");
          domClass.remove(userNode, "hide");
        } else {
          domClass.remove(signInNode, "hide");
          domClass.add(userNode, "hide");
        }
        return promiseUtils.resolve();
      };

      // SIGN IN //
      const userSignIn = () => {
        this.base.portal = new Portal({ url: this.base.config.portalUrl, authMode: "immediate" });
        return this.base.portal.load().then(() => {
          this.emit("portal-user-change", {});
          return updateSignInUI();
        }).otherwise(console.warn);
      };

      // SIGN OUT //
      const userSignOut = () => {
        IdentityManager.destroyCredentials();
        this.base.portal = new Portal({});
        this.base.portal.load().then(() => {
          this.base.portal.user = null;
          this.emit("portal-user-change", {});
          return updateSignInUI();
        }).otherwise(console.warn);

      };

      // USER SIGN IN //
      on(signInNode, "click", userSignIn);

      // SIGN OUT NODE //
      const signOutNode = dom.byId("sign-out-node");
      if(signOutNode) {
        on(signOutNode, "click", userSignOut);
      }

      return checkSignInStatus();
    },

    /**
     *
     * @param view
     * @param initial_bookmark_name
     */
    initializePlaces: function (view, initial_bookmark_name) {

      // WEB SCENE //
      if((view.type === "3d") && view.map.presentation && view.map.presentation.slides && (view.map.presentation.slides.length > 0)) {
        // PLACES PANEL //
        const placesPanel = domConstruct.create("div", { className: "places-panel panel panel-no-padding esri-widget" });
        const placesExpand = new Expand({
          view: view,
          content: placesPanel,
          expandIconClass: "esri-icon-applications",
          expandTooltip: "Places"
        }, domConstruct.create("div"));
        view.ui.add(placesExpand, "bottom-left");

        // SLIDES //
        const slides = view.map.presentation.slides;
        slides.forEach((slide) => {

          const slideNode = domConstruct.create("div", { className: "places-node esri-interactive" }, placesPanel);
          domConstruct.create("img", { className: "", src: slide.thumbnail.url }, slideNode);
          domConstruct.create("span", { className: "places-label", innerHTML: slide.title.text }, slideNode);

          on(slideNode, "click", () => {
            slide.applyTo(view, {
              animate: true,
              speedFactor: 0.33,
              easing: "in-out-cubic"   // linear, in-cubic, out-cubic, in-out-cubic, in-expo, out-expo, in-out-expo
            }).then(() => {
              placesExpand.collapse();
            });
          });
        });

        view.on("layerview-create", (evt) => {
          if(evt.layer.visible) {
            slides.forEach((slide) => {
              slide.visibleLayers.add({ id: evt.layer.id });
            });
          }
        });
      } else {
        // WEB MAP //
        if((view.type === "2d") && view.map.bookmarks && view.map.bookmarks.length > 0) {

          // PLACES DROPDOWN //
          const placesDropdown = domConstruct.create("div", { className: "dropdown js-dropdown esri-widget" });
          view.ui.add(placesDropdown, { position: "top-left", index: 1 });
          const placesBtn = domConstruct.create("button", {
            className: "btn btn-transparent dropdown-btn js-dropdown-toggle",
            "tabindex": "0", "aria-haspopup": "true", "aria-expanded": "false",
            innerHTML: "Places"
          }, placesDropdown);
          domConstruct.create("span", { className: "icon-ui-down" }, placesBtn);
          // MENU //
          const placesMenu = domConstruct.create("nav", { className: "dropdown-menu modifier-class" }, placesDropdown);

          // BOOKMARKS //
          view.map.bookmarks.forEach((bookmark) => {
            // MENU ITEM //
            const bookmarkNode = domConstruct.create("div", {
              className: "dropdown-link",
              role: "menu-item",
              innerHTML: bookmark.name
            }, placesMenu);
            on(bookmarkNode, "click", () => {
              view.goTo({ target: Extent.fromJSON(bookmark.extent) });
            });
            if(bookmark.name === initial_bookmark_name) {
              bookmarkNode.click();
            }
          });

          // INITIALIZE CALCITE DROPDOWN //
          calcite.dropdown();
        }
      }

    },

    /**
     *
     * @param sceneView
     */
    createHeadingSlider: function (sceneView) {

      this.setCameraHeading = (heading, animate) => {
        const camera = sceneView.camera.clone();
        camera.heading = heading;
        sceneView.goTo(camera, { animate: false });
      };

      const headingPanel = domConstruct.create("div", { className: "panel panel-white padding-trailer-quarter" });
      sceneView.ui.add(headingPanel, "top-left");

      const directionsTable = domConstruct.create("table", { className: "slider-table trailer-0" }, headingPanel);
      const directionsRow = domConstruct.create("tr", {}, directionsTable);
      domConstruct.create("td", {}, directionsRow);
      const directionsNode = domConstruct.create("div", { className: "directions-node text-center" }, domConstruct.create("td", {}, directionsRow));
      domConstruct.create("td", {}, directionsRow);

      const directions = [
        { label: "N", tooltip: "North", heading: 0.0 },
        { label: "ne", tooltip: "North East", heading: 45.0 },
        { label: "E", tooltip: "East", heading: 90.0 },
        { label: "se", tooltip: "South East", heading: 135.0 },
        { label: "S", tooltip: "South", heading: 180.0 },
        { label: "sw", tooltip: "South West", heading: 225.0 },
        { label: "W", tooltip: "West", heading: 270.0 },
        { label: "nw", tooltip: "North West", heading: 315.0 },
        { label: "N", tooltip: "North", heading: 360.0 }
      ];
      directions.forEach(dirInfo => {
        const dirNode = domConstruct.create("span", {
          className: "direction-node inline-block text-center font-size--3 avenir-demi esri-interactive",
          innerHTML: dirInfo.label,
          title: dirInfo.tooltip
        }, directionsNode);
        on(dirNode, "click", () => {
          this.setCameraHeading(dirInfo.heading);
        });
      });

      const sliderRow = domConstruct.create("tr", {}, directionsTable);
      const sliderLeftNode = domConstruct.create("span", {
        title: "decrease/left/counter-clockwise",
        className: "direction-node esri-interactive icon-ui-left icon-ui-flush font-size-1"
      }, domConstruct.create("td", {}, sliderRow));
      const slider = domConstruct.create("input", {
        className: "font-size-1",
        type: "range",
        min: 0, max: 360, step: 1, value: 0
      }, domConstruct.create("td", {}, sliderRow));
      const sliderRightNode = domConstruct.create("span", {
        title: "increase/right/clockwise",
        className: "direction-node esri-interactive icon-ui-right icon-ui-flush font-size-1"
      }, domConstruct.create("td", {}, sliderRow));

      on(sliderLeftNode, "click", () => {
        this.setCameraHeading(slider.valueAsNumber - 5);
      });
      on(sliderRightNode, "click", () => {
        this.setCameraHeading(slider.valueAsNumber + 5);
      });

      const headingRow = domConstruct.create("tr", {}, directionsTable);
      domConstruct.create("td", {}, headingRow);
      const heading_label = domConstruct.create("div", { className: "direction-label text-center font-size-1 avenir-bold", innerHTML: "0&deg;" }, domConstruct.create("td", {}, headingRow));
      domConstruct.create("td", {}, headingRow);

      on(slider, "input", () => {
        this.setCameraHeading(slider.valueAsNumber);
      });
      watchUtils.init(sceneView, "camera.heading", (heading) => {
        heading_label.innerHTML = `${heading.toFixed(0)}&deg;`;
        slider.valueAsNumber = heading;
      });

    },

  });
});