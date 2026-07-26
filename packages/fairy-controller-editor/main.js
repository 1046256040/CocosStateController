'use strict';

const electron = require('electron');
const fs = require('fs');
const path = require('path');

const TOOLBAR_ID = 'fairy-controller-editor-toolbar';
const TAB_BUTTON_ID = 'fairy-controller-editor-tab-button';
const TAB_GROUP_ID = 'fairy-controller-editor-tab-group';
const DEBUG_MARKER_ID = 'fairy-controller-editor-debug-marker';
const PANEL_VERTICAL_OFFSET = 120;
const compressScriptUuid = (uuid, fallback) => (Editor && Editor.Utils && Editor.Utils.UuidUtils && Editor.Utils.UuidUtils.compressUuid)
  ? Editor.Utils.UuidUtils.compressUuid(uuid, true)
  : fallback;
const UI_CONTROLLER_SCRIPT_UUID = compressScriptUuid('ec3f6b60-4f95-4e3f-8c4f-f6770a827d6a', 'ec3f6tgT5VOP4xP9ncKgn1g');
const UI_CONTROLLER_GEAR_DISPLAY_UUID = compressScriptUuid('f5924db2-efbf-4c88-b4b6-fd4c8f9ad911', 'f592TbLvv0yItLb9TI+a2RE');
const UI_CONTROLLER_GEAR_TEXT_UUID = compressScriptUuid('0de3d0ef-dbd4-4c70-8251-372c3324db73', '0de3dDv29RMcIJRNywzJNtz');
const UI_CONTROLLER_GEAR_COLOR_UUID = compressScriptUuid('6f6ecf4f-9b92-4eef-a63c-a7a0af8042b1', '6f6ec9PmS4u76Y8p6gK+AQr');
const UI_CONTROLLER_GEAR_POSITION_UUID = compressScriptUuid('14c0e2d1-9914-4cf7-a88f-36ab5041f0fe', '14c0LSZZFM96iPNqtQQfD+');
const UI_CONTROLLER_GEAR_SIZE_UUID = compressScriptUuid('106d1320-a4b5-4b32-8416-7f1987d82994', '106d1320-a4b5-4b32-8416-7f1987d82994');
const UI_CONTROLLER_GEAR_FONT_SIZE_UUID = compressScriptUuid('c188892f-41da-4deb-8d87-6ce79973d268', 'c188892f-41da-4deb-8d87-6ce79973d268');
const UI_CONTROLLER_GEAR_IMAGE_UUID = compressScriptUuid('d0347548-154f-4521-91ec-9641795c8909', 'd0347548-154f-4521-91ec-9641795c8909');
const UI_CONTROLLER_DATA_UUID = '30c0b2wH0JKO5/8O8t27Yj7';
const LEGACY_UI_CONTROLLER_DATA_UUIDS = [
  '30c0bdb0-1f42-4a3b-9ffc-3bcb76ed88fb',
];
const INJECT_SCRIPT = `
(function () {
  if (window.__fairyControllerEditorInjected) {
    return;
  }
  window.__fairyControllerEditorInjected = true;
  window.__fairyControllerToolbarState = window.__fairyControllerToolbarState || {
    controllers: [],
    currentController: '',
    currentPage: '',
    context: null,
  };

  function ensureDebugMarker() {
    var marker = document.getElementById('${DEBUG_MARKER_ID}');
    if (marker) {
      return marker;
    }

    marker = document.createElement('div');
    marker.id = '${DEBUG_MARKER_ID}';
    marker.setAttribute('data-from', 'fairy-controller-editor');
    marker.textContent = 'fairy-controller-editor injected';
    marker.style.display = 'none';
    document.body.appendChild(marker);
    return marker;
  }

  function safeParseControllers(text) {
    if (!text) {
      return [];
    }

    try {
      return JSON.parse(text);
    }
    catch (error) {
      return [];
    }
  }

  function getUIControllerDataClass() {
    if (!window.cc || !cc.js || !cc.js.getClassByName) {
      return null;
    }

    return cc.js.getClassByName('UIControllerData');
  }

  function getUIControllerDataComponent(node) {
    if (!node) {
      return null;
    }

    var klass = getUIControllerDataClass();
    if (klass) {
      return node.getComponent(klass) || null;
    }

    return node.getComponent('UIControllerData') || null;
  }

  function getStorageScene() {
    if (!window.cc || !cc.director) {
      return null;
    }

    var scene = cc.director.getScene && cc.director.getScene();
    return scene || null;
  }

  function getStorageNode() {
    var scene = getStorageScene();
    if (!scene) {
      return null;
    }

    var rootEditingNode = getRootEditingNode();
    if (rootEditingNode && cc.isValid(rootEditingNode, true)) {
      return rootEditingNode;
    }

    var children = scene.children || [];
    for (var i = 0; i < children.length; i++) {
      if (children[i] && cc.isValid(children[i], true)) {
        return children[i];
      }
    }

    return scene;
  }

  function getLegacyStorageComponent() {
    var scene = getStorageScene();
    if (!scene || scene === getStorageNode()) {
      return null;
    }

    return scene.getComponent('UIController') || getUIControllerDataComponent(scene) || null;
  }

  function findAnyControllerStorage() {
    var scene = getStorageScene();
    if (!scene) {
      return null;
    }

    function getComponent(node) {
      if (!node || !cc.isValid(node, true)) {
        return null;
      }

      return node.getComponent('UIController') || getUIControllerDataComponent(node) || null;
    }

    var sceneComponent = getComponent(scene);
    if (sceneComponent) {
      return {
        node: scene,
        component: sceneComponent,
      };
    }

    var stack = scene.children ? scene.children.slice() : [];
    while (stack.length) {
      var current = stack.shift();
      if (!current || !cc.isValid(current, true)) {
        continue;
      }

      var component = getComponent(current);
      if (component) {
        return {
          node: current,
          component: component,
        };
      }

      if (current.children && current.children.length) {
        for (var i = 0; i < current.children.length; i++) {
          stack.push(current.children[i]);
        }
      }
    }

    return null;
  }

  function getPersistenceContext() {
    var scene = getStorageScene();
    var fallbackStorage = findAnyControllerStorage();
    var node = getStorageNode() || (fallbackStorage && fallbackStorage.node) || null;
    var prefabInfo = node && node._prefab ? node._prefab : null;
    var prefabAsset = prefabInfo && prefabInfo.asset ? prefabInfo.asset : null;

    return {
      sceneUuid: scene ? (scene.uuid || scene._id || '') : '',
      rootNodeUuid: node ? (node.uuid || node._id || '') : '',
      rootNodeName: node ? (node.name || '') : '',
      prefabAssetUuid: prefabAsset ? (prefabAsset._uuid || prefabAsset.uuid || '') : '',
      prefabAssetUrl: prefabAsset ? (prefabAsset.nativeUrl || prefabAsset.url || '') : '',
    };
  }

  function getPageToken(page, index) {
    if (!page) {
      return '';
    }

    if (page.id) {
      return page.id;
    }

    if (page.name) {
      return page.name;
    }

    return 'page-' + index;
  }

  function getPageLabel(page, index) {
    if (!page) {
      return String(index);
    }

    return page.name || String(index);
  }

  function getStorageSignature() {
    var fallbackStorage = findAnyControllerStorage();
    var node = getStorageNode() || (fallbackStorage && fallbackStorage.node) || null;
    if (!node) {
      return 'no-node';
    }

    var component = node.getComponent('UIController')
      || getUIControllerDataComponent(node)
      || getLegacyStorageComponent()
      || (fallbackStorage && fallbackStorage.component)
      || null;
    if (!component) {
      return (node.uuid || node.name || 'node') + '|empty';
    }

    return [
      node.uuid || node.name || 'node',
      component.controllersJson || '[]',
      component.previewController || '',
      component.previewPage || '',
    ].join('|');
  }

  function syncStateFromSelection() {
    if (!window.cc) {
      window.__fairyControllerToolbarState = {
        controllers: [],
        currentController: '',
        currentPage: '',
        context: getPersistenceContext(),
      };
      return;
    }

    var fallbackStorage = findAnyControllerStorage();
    var node = getStorageNode() || (fallbackStorage && fallbackStorage.node) || null;
    if (!node) {
      window.__fairyControllerToolbarState = {
        controllers: [],
        currentController: '',
        currentPage: '',
        context: getPersistenceContext(),
      };
      return;
    }

    var component = node.getComponent('UIController')
      || getUIControllerDataComponent(node)
      || getLegacyStorageComponent()
      || (fallbackStorage && fallbackStorage.component)
      || null;
    if (!component) {
      window.__fairyControllerToolbarState = {
        controllers: [],
        currentController: '',
        currentPage: '',
        context: getPersistenceContext(),
      };
      return;
    }

    var controllers = [];
    if (component.getControllers) {
      try {
        controllers = JSON.parse(JSON.stringify(component.getControllers() || []));
      }
      catch (error) {
        controllers = safeParseControllers(component.controllersJson);
      }
    }
    else {
      controllers = safeParseControllers(component.controllersJson);
    }

    window.__fairyControllerToolbarState = {
      controllers: controllers,
      currentController: component.previewController || '',
      currentPage: component.previewPage || '',
      context: getPersistenceContext(),
    };
  }

  function setToolbarPreview(controllerName, pageName) {
    var fallbackStorage = findAnyControllerStorage();
    var node = getStorageNode() || (fallbackStorage && fallbackStorage.node) || null;
    if (!node) {
      return;
    }

    var component = node.getComponent('UIController')
      || getUIControllerDataComponent(node)
      || getLegacyStorageComponent()
      || (fallbackStorage && fallbackStorage.component)
      || null;
    if (!component) {
      return;
    }

    component.previewController = controllerName || '';
    component.previewPage = pageName || '';

    var runtimeController = node.getComponent('UIController') || (component.applyPreview ? component : null);
    if (runtimeController) {
      if (runtimeController.setIndex && controllerName) {
        var controllers = safeParseControllers(component.controllersJson || '[]');
        for (var i = 0; i < controllers.length; i++) {
          var currentController = controllers[i];
          if (!currentController || currentController.name !== controllerName) {
            continue;
          }

          var pages = Array.isArray(currentController.pages) ? currentController.pages : [];
          for (var j = 0; j < pages.length; j++) {
            if (getPageToken(pages[j], j) === pageName || ((pages[j] && pages[j].name) || '') === pageName) {
              runtimeController.setIndex(controllerName, j);
              break;
            }
          }
          break;
        }
      }

      if (runtimeController.setPreview) {
        runtimeController.setPreview(controllerName || '', pageName || '');
      }
      else if (runtimeController.applyPreview) {
        runtimeController.applyPreview();
      }
    }

    syncStateFromSelection();
    if (window.__fairyControllerToolbarApi) {
      window.__fairyControllerToolbarApi.update(window.__fairyControllerToolbarState);
    }
  }

  function openCreatePanel() {
    syncStateFromSelection();
    Editor.Ipc.sendToMain('fairy-controller-editor:open-create-panel', {
      mode: 'create',
      controllers: JSON.parse(JSON.stringify(window.__fairyControllerToolbarState.controllers || [])),
      context: JSON.parse(JSON.stringify(window.__fairyControllerToolbarState.context || null)),
    });
  }

  function openEditPanel(controllerName) {
    syncStateFromSelection();
    var controllers = window.__fairyControllerToolbarState.controllers || [];
    for (var i = 0; i < controllers.length; i++) {
      if (controllers[i] && controllers[i].name === controllerName) {
        Editor.Ipc.sendToMain('fairy-controller-editor:open-create-panel', {
          mode: 'edit',
          controllers: JSON.parse(JSON.stringify(controllers)),
          editingController: JSON.parse(JSON.stringify(controllers[i])),
          context: JSON.parse(JSON.stringify(window.__fairyControllerToolbarState.context || null)),
        });
        return;
      }
    }
  }

  function renderToolbar(group) {
    group.innerHTML = '';

    var state = window.__fairyControllerToolbarState || {};
    var controllers = Array.isArray(state.controllers) ? state.controllers : [];
    var currentController = state.currentController || '';
    var currentPage = state.currentPage || '';

    for (var i = 0; i < controllers.length; i++) {
      var controller = controllers[i] || {};
      var wrapper = document.createElement('div');
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'stretch';
      wrapper.style.gap = '4px';
      wrapper.style.flex = '0 0 auto';

      var label = document.createElement('div');
      label.style.display = 'inline-flex';
      label.style.alignItems = 'center';
      label.style.height = '22px';
      label.style.padding = '0 12px';
      label.style.background = '#2d2d2d';
      label.style.border = '1px solid #4a4a4a';
      label.style.borderRadius = '0';
      label.style.cursor = 'pointer';
      label.style.boxSizing = 'border-box';

      var badge = document.createElement('span');
      badge.textContent = 'C';
      badge.style.marginRight = '8px';
      badge.style.fontWeight = 'bold';
      badge.style.color = '#d7d7d7';

      var name = document.createElement('span');
      name.textContent = controller.name || '';
      name.style.fontWeight = 'bold';
      name.style.color = '#c9c9c9';

      label.appendChild(badge);
      label.appendChild(name);
      label.addEventListener('click', openEditPanel.bind(null, controller.name || ''));
      wrapper.appendChild(label);

      var pages = Array.isArray(controller.pages) ? controller.pages : [];
      var selectedPageToken = '';
      if (typeof controller.selectedIndex === 'number' && controller.selectedIndex >= 0 && controller.selectedIndex < pages.length) {
        selectedPageToken = getPageToken(pages[controller.selectedIndex], controller.selectedIndex);
      }
      else if (controller.name === currentController) {
        selectedPageToken = currentPage || '';
      }
      for (var j = 0; j < pages.length; j++) {
        var pageToken = getPageToken(pages[j], j);
        var page = document.createElement('div');
        page.textContent = j + ':';
        page.style.display = 'inline-flex';
        page.style.alignItems = 'center';
        page.style.justifyContent = 'center';
        page.style.minWidth = '32px';
        page.style.height = '22px';
        page.style.padding = '0 8px';
        page.style.background = selectedPageToken === pageToken ? '#2d2d2d' : '#2d2d2d';
        page.style.border = selectedPageToken === pageToken ? '1px solid #d08a2d' : '1px solid #4a4a4a';
        page.style.borderRadius = '0';
        page.style.color = '#d08a2d';
        page.style.cursor = 'pointer';
        page.style.boxSizing = 'border-box';
        page.title = getPageLabel(pages[j], j);
        page.addEventListener('click', (function (nextControllerName, nextPageToken) {
          return function (event) {
            event.preventDefault();
            event.stopPropagation();
            setToolbarPreview(nextControllerName, nextPageToken);
          };
        })(controller.name || '', pageToken));
        wrapper.appendChild(page);
      }

      group.appendChild(wrapper);
    }

    var button = document.createElement('div');
    button.id = '${TAB_BUTTON_ID}';
    button.textContent = '+ 增加控制器';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.flex = '0 0 auto';
    button.style.height = '22px';
    button.style.padding = '0 12px';
    button.style.marginLeft = controllers.length ? '2px' : '0';
    button.style.color = '#c9c9c9';
    button.style.fontSize = '12px';
    button.style.lineHeight = '22px';
    button.style.cursor = 'pointer';
    button.style.background = '#4a4a4a';
    button.style.border = '1px solid #4a4a4a';
    button.style.borderRadius = '0';
    button.style.boxSizing = 'border-box';
    button.style.userSelect = 'none';
    button.addEventListener('mouseenter', function () {
      button.style.background = '#555';
    });
    button.addEventListener('mouseleave', function () {
      button.style.background = '#4a4a4a';
    });
    button.addEventListener('click', openCreatePanel);

    group.appendChild(button);
  }

  function createToolbar() {
    syncStateFromSelection();
    var sceneFrame = document.querySelector('ui-panel-frame#scene');
    if (!sceneFrame) {
      return false;
    }

    var panel = sceneFrame.closest('ui-dock-panel');
    if (!panel || !panel.shadowRoot) {
      return false;
    }

    var root = panel.shadowRoot;
    var tabs = root.querySelector('ui-dock-tabs#tabs');
    if (!tabs) {
      return false;
    }

    var legacyToolbar = root.querySelector('#${TOOLBAR_ID}');
    if (legacyToolbar) {
      legacyToolbar.remove();
    }

    if (!tabs.shadowRoot) {
      return false;
    }

    var tabsContainer = tabs.shadowRoot.querySelector('.tabs');
    if (!tabsContainer) {
      return false;
    }

    tabsContainer.style.display = 'flex';
    tabsContainer.style.alignItems = 'stretch';
    tabsContainer.style.flexWrap = 'nowrap';
    tabsContainer.style.minWidth = '0';

    var staleButton = tabs.shadowRoot.querySelector('#${TAB_BUTTON_ID}');
    if (staleButton && staleButton.parentElement && staleButton.parentElement.id !== '${TAB_GROUP_ID}') {
      staleButton.parentElement.removeChild(staleButton);
    }

    var group = tabs.shadowRoot.querySelector('#${TAB_GROUP_ID}');
    if (!group) {
      group = document.createElement('div');
      group.id = '${TAB_GROUP_ID}';
      group.style.display = 'inline-flex';
      group.style.alignItems = 'stretch';
      group.style.gap = '2px';
      group.style.flexWrap = 'nowrap';
      group.style.flex = '0 1 auto';
      group.style.minWidth = '0';
      group.style.maxWidth = '100%';
      group.style.overflowX = 'auto';
      group.style.overflowY = 'hidden';
      group.style.whiteSpace = 'nowrap';
      group.style.scrollbarWidth = 'none';
      group.style.msOverflowStyle = 'none';
      tabsContainer.appendChild(group);
    }

    if (group.parentElement !== tabsContainer) {
      tabsContainer.appendChild(group);
    }

    group.style.flex = '0 1 auto';
    group.style.minWidth = '0';
    group.style.maxWidth = '100%';
    group.style.overflowX = 'auto';
    group.style.overflowY = 'hidden';
    group.style.whiteSpace = 'nowrap';
    group.style.scrollbarWidth = 'none';
    group.style.msOverflowStyle = 'none';
    group.style.paddingBottom = '0';

    var scrollbarStyle = tabs.shadowRoot.querySelector('#${TAB_GROUP_ID}-scrollbar-style');
    if (!scrollbarStyle) {
      scrollbarStyle = document.createElement('style');
      scrollbarStyle.id = '${TAB_GROUP_ID}-scrollbar-style';
      scrollbarStyle.textContent = '#${TAB_GROUP_ID}::-webkit-scrollbar{display:none;width:0;height:0;}';
      tabs.shadowRoot.appendChild(scrollbarStyle);
    }

    renderToolbar(group);
    return true;
  }

  function findInspectorFrame() {
    var frames = queryAllDeep('ui-panel-frame');
    for (var i = 0; i < frames.length; i++) {
      var id = (frames[i].id || '').toLowerCase();
      var name = (frames[i].getAttribute('name') || '').toLowerCase();
      if (id.indexOf('inspector') !== -1 || id.indexOf('property') !== -1 || name.indexOf('inspector') !== -1) {
        return frames[i];
      }
    }
    return null;
  }

  function queryAllDeep(selector, root) {
    var results = [];
    var visited = [];

    function walk(currentRoot) {
      if (!currentRoot || visited.indexOf(currentRoot) !== -1) {
        return;
      }
      visited.push(currentRoot);

      if (currentRoot.querySelectorAll) {
        var matches = currentRoot.querySelectorAll(selector);
        for (var i = 0; i < matches.length; i++) {
          if (results.indexOf(matches[i]) === -1) {
            results.push(matches[i]);
          }
        }
      }

      var elements = currentRoot.querySelectorAll ? currentRoot.querySelectorAll('*') : [];
      for (var j = 0; j < elements.length; j++) {
        if (elements[j] && elements[j].shadowRoot) {
          walk(elements[j].shadowRoot);
        }
      }
    }

    walk(root || document);
    return results;
  }

  function findInspectorInsertTarget() {
    var inspectorFrame = findInspectorFrame();
    if (inspectorFrame && inspectorFrame.shadowRoot) {
      var props = inspectorFrame.shadowRoot.querySelector('.props');
      if (props) {
        var addComponentRow = null;
        var rows = props.querySelectorAll('div');
        for (var i = 0; i < rows.length; i++) {
          var text = (rows[i].textContent || '').replace(/\s+/g, '');
          if (text === '添加组件') {
            addComponentRow = rows[i];
            break;
          }
        }
        return {
          container: props,
          anchor: addComponentRow,
        };
      }
    }

    if (inspectorFrame && inspectorFrame.parentElement) {
      return {
        container: inspectorFrame.parentElement,
        anchor: null,
      };
    }

    return null;
  }

  function getSelectedNodeUuid() {
    if (!window.Editor || !Editor.Selection || !Editor.Selection.curActivate) {
      return '';
    }

    return Editor.Selection.curActivate('node') || '';
  }

  function getSelectedNode() {
    var scene = getStorageScene();
    var uuid = getSelectedNodeUuid();
    if (!scene || !uuid) {
      return null;
    }

    if (scene.uuid === uuid) {
      return scene;
    }

    if (scene.getChildByUuid) {
      var directMatch = scene.getChildByUuid(uuid);
      if (directMatch) {
        return directMatch;
      }
    }

    var stack = scene.children ? scene.children.slice() : [];
    while (stack.length) {
      var current = stack.shift();
      if (!current || !cc.isValid(current, true)) {
        continue;
      }
      if (current.uuid === uuid) {
        return current;
      }
      if (current.children && current.children.length) {
        for (var i = 0; i < current.children.length; i++) {
          stack.push(current.children[i]);
        }
      }
    }

    return null;
  }

  function getRootEditingNode() {
    var scene = getStorageScene();
    var selectedNode = getSelectedNode();
    if (!scene || !selectedNode) {
      return null;
    }

    var current = selectedNode;
    while (current && current.parent && current.parent !== scene) {
      current = current.parent;
    }

    return current || null;
  }

  function safeParseBindings(text) {
    if (!text) {
      return [];
    }

    try {
      var parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    }
    catch (error) {
      return [];
    }
  }

  function getRootControllerComponent(createIfMissing) {
    var fallbackStorage = findAnyControllerStorage();
    var node = getStorageNode() || (fallbackStorage && fallbackStorage.node) || null;
    if (!node) {
      return null;
    }

    var controller = node.getComponent('UIController') || null;
    if (!controller && createIfMissing) {
      controller = node.addComponent('UIController');
      var legacy = getUIControllerDataComponent(node)
        || getLegacyStorageComponent()
        || (fallbackStorage && fallbackStorage.component)
        || null;
      if (controller && legacy) {
        controller.controllersJson = legacy.controllersJson || '[]';
        controller.previewController = legacy.previewController || '';
        controller.previewPage = legacy.previewPage || '';
      }
    }

    return controller || null;
  }

  function getNodePathFromRoot(rootNode, node) {
    if (!rootNode || !node) {
      return '';
    }

    if (rootNode === node) {
      return '';
    }

    var names = [];
    var current = node;
    while (current && current !== rootNode) {
      names.unshift(current.name || '');
      current = current.parent || null;
    }

    return current === rootNode ? names.join('/') : '';
  }

  function getDisplayBinding(component, rootNode, node) {
    if (!component || !rootNode || !node) {
      return null;
    }

    var bindings = safeParseBindings(component.bindingsJson || '[]');
    var nodePath = getNodePathFromRoot(rootNode, node);
    var nodeUuid = node.uuid || node._id || '';
    for (var i = 0; i < bindings.length; i++) {
      var binding = bindings[i];
      if (!binding || binding.type !== 'display') {
        continue;
      }
      if (binding.nodePath === nodePath || (nodeUuid && binding.nodeUuid === nodeUuid)) {
        return binding;
      }
    }
    return null;
  }

  function getDisplayBindingConditions(binding) {
    if (!binding) {
      return [];
    }

    var values = binding.values || {};
    var conditions = Array.isArray(values.conditions) ? values.conditions : [];
    var result = [];
    for (var i = 0; i < conditions.length; i++) {
      var condition = conditions[i];
      if (!condition || !condition.controllerName) {
        continue;
      }

      var pageIndex = Array.isArray(condition.visiblePages) && condition.visiblePages.length
        ? condition.visiblePages[0]
        : -1;
      var pageName = getPageRefByIndex(condition.controllerName || '', pageIndex);
      result.push({
        controllerName: condition.controllerName || '',
        pageName: pageName || '',
      });
    }

    if (!result.length && binding.controllerName) {
      var legacyPageIndex = values && Array.isArray(values.visiblePages) && values.visiblePages.length
        ? values.visiblePages[0]
        : -1;
      result.push({
        controllerName: binding.controllerName || '',
        pageName: getPageRefByIndex(binding.controllerName || '', legacyPageIndex),
      });
    }

    return result;
  }

  function getDisplayBindingMode(binding) {
    return binding && binding.values && binding.values.mode === 'and' ? 'and' : 'or';
  }

  function getPageRefByIndex(controllerName, pageIndex) {
    if (!controllerName || pageIndex < 0) {
      return '';
    }

    var controllers = window.__fairyControllerToolbarState.controllers || [];
    for (var i = 0; i < controllers.length; i++) {
      var controller = controllers[i];
      if (!controller || controller.name !== controllerName) {
        continue;
      }

      var pages = controller.pages || [];
      if (pageIndex >= 0 && pageIndex < pages.length) {
        return getPageOptionValue(pages[pageIndex], pageIndex);
      }
      return '';
    }

    return '';
  }

  function normalizeDisplayCondition(condition) {
    if (!condition || !condition.controllerName) {
      return null;
    }

    var pageIndex = getPageIndexForController(condition.controllerName || '', condition.pageName || '');
    if (pageIndex < 0) {
      return null;
    }

    return {
      controllerName: condition.controllerName || '',
      visiblePages: [pageIndex],
    };
  }

  function getDefaultDisplayCondition() {
    var state = window.__fairyControllerToolbarState || {};
    var controllers = state.controllers || [];
    var controllerName = state.currentController || '';
    var pageName = state.currentPage || '';

    if (!controllerName && controllers.length) {
      controllerName = controllers[0].name || '';
      if (controllers[0].pages && controllers[0].pages.length) {
        pageName = getPageOptionValue(controllers[0].pages[0], 0);
      }
    }

    if (!pageName && controllerName) {
      var controller = null;
      for (var i = 0; i < controllers.length; i++) {
        if (controllers[i] && controllers[i].name === controllerName) {
          controller = controllers[i];
          break;
        }
      }
      if (controller && controller.pages && controller.pages.length) {
        pageName = getPageOptionValue(controller.pages[0], 0);
      }
    }

    return {
      controllerName: controllerName || '',
      pageName: pageName || '',
    };
  }

  function getPropertyGear(node) {
    return node ? node.getComponent('UIControllerGearDisplay') : null;
  }

  function getPropertyTextGear(node) {
    return node ? node.getComponent('UIControllerGearText') : null;
  }

  function getPropertyPositionGear(node) {
    return node ? node.getComponent('UIControllerGearPosition') : null;
  }

  function getPropertyColorGear(node) {
    return node ? node.getComponent('UIControllerGearColor') : null;
  }

  function getPropertySizeGear(node) {
    return node ? node.getComponent('UIControllerGearSize') : null;
  }

  function getPropertyFontSizeGear(node) {
    return node ? node.getComponent('UIControllerGearFontSize') : null;
  }

  function getPropertyImageGear(node) {
    return node ? node.getComponent('UIControllerGearImage') : null;
  }

  function getTextStateClass() {
    if (!window.cc || !cc.js || !cc.js.getClassByName) {
      return null;
    }

    return cc.js.getClassByName('UIControllerTextState');
  }

  function createTextState(page, value) {
    var StateClass = getTextStateClass();
    var state = StateClass ? new StateClass() : {};
    state.page = page || '';
    state.value = value || '';
    return state;
  }

  function getColorStateClass() {
    if (!window.cc || !cc.js || !cc.js.getClassByName) {
      return null;
    }

    return cc.js.getClassByName('UIControllerColorState');
  }

  function cloneColorValue(color) {
    var source = color || new cc.Color(255, 255, 255, 255);
    return new cc.Color(source.r || 0, source.g || 0, source.b || 0, typeof source.a === 'number' ? source.a : 255);
  }

  function isSameColorValue(a, b) {
    if (!a || !b) {
      return false;
    }

    return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
  }

  function serializeColorValue(color) {
    var source = color || new cc.Color(255, 255, 255, 255);
    return {
      r: source.r || 0,
      g: source.g || 0,
      b: source.b || 0,
      a: typeof source.a === 'number' ? source.a : 255,
    };
  }

  function createColorState(page, color) {
    var StateClass = getColorStateClass();
    var state = StateClass ? new StateClass() : {};
    state.page = page || '';
    state.color = cloneColorValue(color);
    return state;
  }

  function getSizeStateClass() {
    if (!window.cc || !cc.js || !cc.js.getClassByName) {
      return null;
    }

    return cc.js.getClassByName('UIControllerSizeState');
  }

  function serializeSizeValue(value) {
    var source = value || {};
    return {
      width: typeof source.width === 'number' ? source.width : 0,
      height: typeof source.height === 'number' ? source.height : 0,
      scaleX: typeof source.scaleX === 'number' ? source.scaleX : 1,
      scaleY: typeof source.scaleY === 'number' ? source.scaleY : 1,
    };
  }

  function readNodeSizeValue(node) {
    return {
      width: node ? node.width : 0,
      height: node ? node.height : 0,
      scaleX: node ? node.scaleX : 1,
      scaleY: node ? node.scaleY : 1,
    };
  }

  function isSameSizeValue(a, b) {
    if (!a || !b) {
      return false;
    }

    return a.width === b.width
      && a.height === b.height
      && a.scaleX === b.scaleX
      && a.scaleY === b.scaleY;
  }

  function createSizeState(page, value) {
    var StateClass = getSizeStateClass();
    var state = StateClass ? new StateClass() : {};
    var serialized = serializeSizeValue(value);
    state.page = page || '';
    state.width = serialized.width;
    state.height = serialized.height;
    state.scaleX = serialized.scaleX;
    state.scaleY = serialized.scaleY;
    return state;
  }

  function getFontSizeStateClass() {
    if (!window.cc || !cc.js || !cc.js.getClassByName) {
      return null;
    }

    return cc.js.getClassByName('UIControllerFontSizeState');
  }

  function createFontSizeState(page, value) {
    var StateClass = getFontSizeStateClass();
    var state = StateClass ? new StateClass() : {};
    state.page = page || '';
    state.value = typeof value === 'number' ? value : 0;
    return state;
  }

  function getImageStateClass() {
    if (!window.cc || !cc.js || !cc.js.getClassByName) {
      return null;
    }

    return cc.js.getClassByName('UIControllerImageState');
  }

  function createImageState(page, spriteFrame) {
    var StateClass = getImageStateClass();
    var state = StateClass ? new StateClass() : {};
    state.page = page || '';
    state.spriteFrame = spriteFrame || null;
    return state;
  }

  function getColorStateForPage(gear, pageRef) {
    if (!gear || !Array.isArray(gear.states) || !pageRef) {
      return null;
    }

    for (var i = 0; i < gear.states.length; i++) {
      var state = gear.states[i];
      if (state && state.page === pageRef) {
        return state;
      }
    }

    return null;
  }

  function getTextStateForPage(gear, pageRef) {
    if (!gear || !Array.isArray(gear.states) || !pageRef) {
      return null;
    }

    for (var i = 0; i < gear.states.length; i++) {
      var state = gear.states[i];
      if (state && state.page === pageRef) {
        return state;
      }
    }

    return null;
  }

  function getSizeStateForPage(gear, pageRef) {
    if (!gear || !Array.isArray(gear.states) || !pageRef) {
      return null;
    }

    for (var i = 0; i < gear.states.length; i++) {
      var state = gear.states[i];
      if (state && state.page === pageRef) {
        return state;
      }
    }

    return null;
  }

  function getFontSizeStateForPage(gear, pageRef) {
    if (!gear || !Array.isArray(gear.states) || !pageRef) {
      return null;
    }

    for (var i = 0; i < gear.states.length; i++) {
      var state = gear.states[i];
      if (state && state.page === pageRef) {
        return state;
      }
    }

    return null;
  }

  function getImageStateForPage(gear, pageRef) {
    if (!gear || !Array.isArray(gear.states) || !pageRef) {
      return null;
    }

    for (var i = 0; i < gear.states.length; i++) {
      var state = gear.states[i];
      if (state && state.page === pageRef) {
        return state;
      }
    }

    return null;
  }

  function getTextSelectionState(node) {
    var key = getNodeStateKey(node);
    if (!key) {
      return null;
    }

    var store = window.__fairyControllerTextSelectionState || {};
    return store[key] || null;
  }

  function setTextSelectionState(node, controllerName, pageName) {
    var key = getNodeStateKey(node);
    if (!key) {
      return;
    }

    window.__fairyControllerTextSelectionState = window.__fairyControllerTextSelectionState || {};
    window.__fairyControllerTextSelectionState[key] = {
      controllerName: controllerName || '',
      pageName: pageName || '',
    };
  }

  function getResolvedTextPageName(controllerName, fallbackPageName) {
    if (!controllerName) {
      return '';
    }

    var controllers = window.__fairyControllerToolbarState.controllers || [];
    var toolbarControllerName = window.__fairyControllerToolbarState.currentController || '';
    var toolbarPageName = window.__fairyControllerToolbarState.currentPage || '';
    for (var i = 0; i < controllers.length; i++) {
      var controller = controllers[i];
      if (!controller || controller.name !== controllerName) {
        continue;
      }

      var pages = Array.isArray(controller.pages) ? controller.pages : [];
      var preferredRefs = [];
      if (toolbarControllerName === controllerName && toolbarPageName) {
        preferredRefs.push(toolbarPageName);
      }
      if (fallbackPageName) {
        preferredRefs.push(fallbackPageName);
      }
      if (typeof controller.selectedIndex === 'number' && controller.selectedIndex >= 0 && controller.selectedIndex < pages.length) {
        preferredRefs.push(getPageOptionValue(pages[controller.selectedIndex], controller.selectedIndex));
      }

      for (var j = 0; j < preferredRefs.length; j++) {
        var preferredRef = preferredRefs[j];
        for (var k = 0; k < pages.length; k++) {
          var token = getPageOptionValue(pages[k], k);
          if (token === preferredRef || ((pages[k] && pages[k].name) || '') === preferredRef) {
            return token;
          }
        }
      }

      return pages.length ? getPageOptionValue(pages[0], 0) : '';
    }

    return fallbackPageName || '';
  }

  function hasControllerName(controllerName) {
    if (!controllerName) {
      return false;
    }

    var controllers = window.__fairyControllerToolbarState.controllers || [];
    for (var i = 0; i < controllers.length; i++) {
      if (controllers[i] && controllers[i].name === controllerName) {
        return true;
      }
    }

    return false;
  }

  function getColorSelectionState(node) {
    var key = getNodeStateKey(node);
    if (!key) {
      return null;
    }

    var store = window.__fairyControllerColorSelectionState || {};
    return store[key] || null;
  }

  function setColorSelectionState(node, controllerName, pageName) {
    var key = getNodeStateKey(node);
    if (!key) {
      return;
    }

    window.__fairyControllerColorSelectionState = window.__fairyControllerColorSelectionState || {};
    window.__fairyControllerColorSelectionState[key] = {
      controllerName: controllerName || '',
      pageName: pageName || '',
    };
  }

  function getSizeSelectionState(node) {
    var key = getNodeStateKey(node);
    if (!key) {
      return null;
    }

    var store = window.__fairyControllerSizeSelectionState || {};
    return store[key] || null;
  }

  function setSizeSelectionState(node, controllerName, pageName) {
    var key = getNodeStateKey(node);
    if (!key) {
      return;
    }

    window.__fairyControllerSizeSelectionState = window.__fairyControllerSizeSelectionState || {};
    window.__fairyControllerSizeSelectionState[key] = {
      controllerName: controllerName || '',
      pageName: pageName || '',
    };
  }

  function getFontSizeSelectionState(node) {
    var key = getNodeStateKey(node);
    if (!key) {
      return null;
    }

    var store = window.__fairyControllerFontSizeSelectionState || {};
    return store[key] || null;
  }

  function setFontSizeSelectionState(node, controllerName, pageName) {
    var key = getNodeStateKey(node);
    if (!key) {
      return;
    }

    window.__fairyControllerFontSizeSelectionState = window.__fairyControllerFontSizeSelectionState || {};
    window.__fairyControllerFontSizeSelectionState[key] = {
      controllerName: controllerName || '',
      pageName: pageName || '',
    };
  }

  function getImageSelectionState(node) {
    var key = getNodeStateKey(node);
    if (!key) {
      return null;
    }

    var store = window.__fairyControllerImageSelectionState || {};
    return store[key] || null;
  }

  function setImageSelectionState(node, controllerName, pageName) {
    var key = getNodeStateKey(node);
    if (!key) {
      return;
    }

    window.__fairyControllerImageSelectionState = window.__fairyControllerImageSelectionState || {};
    window.__fairyControllerImageSelectionState[key] = {
      controllerName: controllerName || '',
      pageName: pageName || '',
    };
  }

  function getEffectiveTextSelectionState(node, gear) {
    var selectionState = getTextSelectionState(node);
    var nextGear = gear || getPropertyTextGear(node);
    if (!selectionState && !nextGear) {
      return selectionState;
    }

    var selectionControllerName = selectionState && selectionState.controllerName
      ? selectionState.controllerName
      : '';
    var controllerName = hasControllerName(selectionControllerName)
      ? selectionControllerName
      : ((nextGear && nextGear.controllerName) || '');
    var fallbackPageName = selectionState && selectionState.pageName
      ? selectionState.pageName
      : '';
    if (!fallbackPageName && nextGear && Array.isArray(nextGear.states) && nextGear.states.length) {
      for (var i = 0; i < nextGear.states.length; i++) {
        if (nextGear.states[i] && nextGear.states[i].page) {
          fallbackPageName = nextGear.states[i].page;
          break;
        }
      }
    }

    var pageName = getResolvedTextPageName(controllerName, fallbackPageName);

    if (controllerName && pageName) {
      if (
        !selectionState
        || selectionState.controllerName !== controllerName
        || selectionState.pageName !== pageName
      ) {
        setTextSelectionState(node, controllerName, pageName);
      }
      selectionState = {
        controllerName: controllerName,
        pageName: pageName,
      };
    }

    return selectionState;
  }

  function getEffectiveColorSelectionState(node, gear) {
    var selectionState = getColorSelectionState(node);
    var nextGear = gear || getPropertyColorGear(node);
    if (!selectionState && !nextGear) {
      return selectionState;
    }

    var selectionControllerName = selectionState && selectionState.controllerName
      ? selectionState.controllerName
      : '';
    var controllerName = hasControllerName(selectionControllerName)
      ? selectionControllerName
      : ((nextGear && nextGear.controllerName) || '');
    var fallbackPageName = selectionState && selectionState.pageName
      ? selectionState.pageName
      : '';
    if (!fallbackPageName && nextGear && Array.isArray(nextGear.states) && nextGear.states.length) {
      for (var i = 0; i < nextGear.states.length; i++) {
        if (nextGear.states[i] && nextGear.states[i].page) {
          fallbackPageName = nextGear.states[i].page;
          break;
        }
      }
    }

    var pageName = getResolvedTextPageName(controllerName, fallbackPageName);

    if (controllerName && pageName) {
      if (
        !selectionState
        || selectionState.controllerName !== controllerName
        || selectionState.pageName !== pageName
      ) {
        setColorSelectionState(node, controllerName, pageName);
      }
      selectionState = {
        controllerName: controllerName,
        pageName: pageName,
      };
    }

    return selectionState;
  }

  function getEffectiveSizeSelectionState(node, gear) {
    var selectionState = getSizeSelectionState(node);
    var nextGear = gear || getPropertySizeGear(node);
    if (!selectionState && !nextGear) {
      return selectionState;
    }

    var selectionControllerName = selectionState && selectionState.controllerName
      ? selectionState.controllerName
      : '';
    var controllerName = hasControllerName(selectionControllerName)
      ? selectionControllerName
      : ((nextGear && nextGear.controllerName) || '');
    var fallbackPageName = selectionState && selectionState.pageName
      ? selectionState.pageName
      : '';
    if (!fallbackPageName && nextGear && Array.isArray(nextGear.states) && nextGear.states.length) {
      for (var i = 0; i < nextGear.states.length; i++) {
        if (nextGear.states[i] && nextGear.states[i].page) {
          fallbackPageName = nextGear.states[i].page;
          break;
        }
      }
    }

    var pageName = getResolvedTextPageName(controllerName, fallbackPageName);

    if (controllerName && pageName) {
      if (
        !selectionState
        || selectionState.controllerName !== controllerName
        || selectionState.pageName !== pageName
      ) {
        setSizeSelectionState(node, controllerName, pageName);
      }
      selectionState = {
        controllerName: controllerName,
        pageName: pageName,
      };
    }

    return selectionState;
  }

  function getEffectiveFontSizeSelectionState(node, gear) {
    var selectionState = getFontSizeSelectionState(node);
    var nextGear = gear || getPropertyFontSizeGear(node);
    if (!selectionState && !nextGear) {
      return selectionState;
    }

    var selectionControllerName = selectionState && selectionState.controllerName
      ? selectionState.controllerName
      : '';
    var controllerName = hasControllerName(selectionControllerName)
      ? selectionControllerName
      : ((nextGear && nextGear.controllerName) || '');
    var fallbackPageName = selectionState && selectionState.pageName
      ? selectionState.pageName
      : '';
    if (!fallbackPageName && nextGear && Array.isArray(nextGear.states) && nextGear.states.length) {
      for (var i = 0; i < nextGear.states.length; i++) {
        if (nextGear.states[i] && nextGear.states[i].page) {
          fallbackPageName = nextGear.states[i].page;
          break;
        }
      }
    }

    var pageName = getResolvedTextPageName(controllerName, fallbackPageName);

    if (controllerName && pageName) {
      if (
        !selectionState
        || selectionState.controllerName !== controllerName
        || selectionState.pageName !== pageName
      ) {
        setFontSizeSelectionState(node, controllerName, pageName);
      }
      selectionState = {
        controllerName: controllerName,
        pageName: pageName,
      };
    }

    return selectionState;
  }

  function getEffectiveImageSelectionState(node, gear) {
    var selectionState = getImageSelectionState(node);
    var nextGear = gear || getPropertyImageGear(node);
    if (!selectionState && !nextGear) {
      return selectionState;
    }

    var selectionControllerName = selectionState && selectionState.controllerName
      ? selectionState.controllerName
      : '';
    var controllerName = hasControllerName(selectionControllerName)
      ? selectionControllerName
      : ((nextGear && nextGear.controllerName) || '');
    var fallbackPageName = selectionState && selectionState.pageName
      ? selectionState.pageName
      : '';
    if (!fallbackPageName && nextGear && Array.isArray(nextGear.states) && nextGear.states.length) {
      for (var i = 0; i < nextGear.states.length; i++) {
        if (nextGear.states[i] && nextGear.states[i].page) {
          fallbackPageName = nextGear.states[i].page;
          break;
        }
      }
    }

    var pageName = getResolvedTextPageName(controllerName, fallbackPageName);

    if (controllerName && pageName) {
      if (
        !selectionState
        || selectionState.controllerName !== controllerName
        || selectionState.pageName !== pageName
      ) {
        setImageSelectionState(node, controllerName, pageName);
      }
      selectionState = {
        controllerName: controllerName,
        pageName: pageName,
      };
    }

    return selectionState;
  }

  function syncTextGearStateFromLabel(node) {
    if (!node) {
      return;
    }

    var gear = getPropertyTextGear(node);
    var label = node.getComponent(cc.Label);
    var selectionState = getEffectiveTextSelectionState(node, gear);
    if (!gear || !label || !selectionState || !selectionState.controllerName || !selectionState.pageName) {
      return;
    }

    var rootController = getRootControllerComponent(false);
    if (rootController) {
      var activeControllerName = rootController.getActiveControllerName
        ? (rootController.getActiveControllerName() || '')
        : (rootController.previewController || '');
      var activePageId = rootController.getActivePageId
        ? (rootController.getActivePageId() || '')
        : '';
      var activePageName = rootController.getActivePageName
        ? (rootController.getActivePageName() || '')
        : (rootController.previewPage || '');

      if (
        activeControllerName !== selectionState.controllerName
        || (
          selectionState.pageName !== activePageId
          && selectionState.pageName !== activePageName
        )
      ) {
        return;
      }
    }

    if (!gear.targetLabel) {
      gear.targetLabel = label;
    }
    if (!gear.defaultValue) {
      gear.defaultValue = label.string || '';
    }

    gear.controllerName = selectionState.controllerName || '';
    var states = Array.isArray(gear.states) ? gear.states.slice() : [];
    var matched = false;
    for (var i = 0; i < states.length; i++) {
      if (states[i] && states[i].page === selectionState.pageName) {
        if ((states[i].value || '') !== (label.string || '')) {
          states[i].value = label.string || '';
          gear.states = states;
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      states.push(createTextState(selectionState.pageName, label.string || ''));
      gear.states = states;
    }
  }

  function syncColorGearStateFromNode(node) {
    if (!node) {
      return;
    }

    var gear = getPropertyColorGear(node);
    var selectionState = getEffectiveColorSelectionState(node, gear);
    if (!gear || !selectionState || !selectionState.controllerName || !selectionState.pageName) {
      return;
    }

    var rootController = getRootControllerComponent(false);
    if (rootController) {
      var activeControllerName = rootController.getActiveControllerName
        ? (rootController.getActiveControllerName() || '')
        : (rootController.previewController || '');
      var activePageId = rootController.getActivePageId
        ? (rootController.getActivePageId() || '')
        : '';
      var activePageName = rootController.getActivePageName
        ? (rootController.getActivePageName() || '')
        : (rootController.previewPage || '');

      if (
        activeControllerName !== selectionState.controllerName
        || (
          selectionState.pageName !== activePageId
          && selectionState.pageName !== activePageName
        )
      ) {
        return;
      }
    }

    gear.controllerName = selectionState.controllerName || '';
    var states = Array.isArray(gear.states) ? gear.states.slice() : [];
    var matched = false;
    for (var i = 0; i < states.length; i++) {
      if (states[i] && states[i].page === selectionState.pageName) {
        if (!isSameColorValue(states[i].color, node.color)) {
          states[i].color = cloneColorValue(node.color);
          gear.states = states;
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      states.push(createColorState(selectionState.pageName, node.color));
      gear.states = states;
    }
  }

  function syncSizeGearStateFromNode(node) {
    if (!node) {
      return;
    }

    var gear = getPropertySizeGear(node);
    var selectionState = getEffectiveSizeSelectionState(node, gear);
    if (!gear || !selectionState || !selectionState.controllerName || !selectionState.pageName) {
      return;
    }

    var rootController = getRootControllerComponent(false);
    if (rootController) {
      var activeControllerName = rootController.getActiveControllerName
        ? (rootController.getActiveControllerName() || '')
        : (rootController.previewController || '');
      var activePageId = rootController.getActivePageId
        ? (rootController.getActivePageId() || '')
        : '';
      var activePageName = rootController.getActivePageName
        ? (rootController.getActivePageName() || '')
        : (rootController.previewPage || '');

      if (
        activeControllerName !== selectionState.controllerName
        || (
          selectionState.pageName !== activePageId
          && selectionState.pageName !== activePageName
        )
      ) {
        return;
      }
    }

    gear.controllerName = selectionState.controllerName || '';
    var states = Array.isArray(gear.states) ? gear.states.slice() : [];
    var currentValue = readNodeSizeValue(node);
    var matched = false;
    for (var i = 0; i < states.length; i++) {
      if (states[i] && states[i].page === selectionState.pageName) {
        if (!isSameSizeValue(states[i], currentValue)) {
          states[i].width = currentValue.width;
          states[i].height = currentValue.height;
          states[i].scaleX = currentValue.scaleX;
          states[i].scaleY = currentValue.scaleY;
          gear.states = states;
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      states.push(createSizeState(selectionState.pageName, currentValue));
      gear.states = states;
    }
  }

  function syncFontSizeGearStateFromNode(node) {
    if (!node) {
      return;
    }

    var gear = getPropertyFontSizeGear(node);
    var selectionState = getEffectiveFontSizeSelectionState(node, gear);
    var textComponent = node.getComponent(cc.Label) || (cc.RichText ? node.getComponent(cc.RichText) : null);
    if (!gear || !textComponent || !selectionState || !selectionState.controllerName || !selectionState.pageName) {
      return;
    }

    var rootController = getRootControllerComponent(false);
    if (rootController) {
      var activeControllerName = rootController.getActiveControllerName
        ? (rootController.getActiveControllerName() || '')
        : (rootController.previewController || '');
      var activePageId = rootController.getActivePageId
        ? (rootController.getActivePageId() || '')
        : '';
      var activePageName = rootController.getActivePageName
        ? (rootController.getActivePageName() || '')
        : (rootController.previewPage || '');

      if (
        activeControllerName !== selectionState.controllerName
        || (
          selectionState.pageName !== activePageId
          && selectionState.pageName !== activePageName
        )
      ) {
        return;
      }
    }

    gear.controllerName = selectionState.controllerName || '';
    var states = Array.isArray(gear.states) ? gear.states.slice() : [];
    var currentValue = textComponent.fontSize || 0;
    var matched = false;
    for (var i = 0; i < states.length; i++) {
      if (states[i] && states[i].page === selectionState.pageName) {
        if ((states[i].value || 0) !== currentValue) {
          states[i].value = currentValue;
          gear.states = states;
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      states.push(createFontSizeState(selectionState.pageName, currentValue));
      gear.states = states;
    }
  }

  function syncImageGearStateFromNode(node) {
    if (!node) {
      return;
    }

    var gear = getPropertyImageGear(node);
    var sprite = node.getComponent(cc.Sprite);
    var selectionState = getEffectiveImageSelectionState(node, gear);
    if (!gear || !sprite || !selectionState || !selectionState.controllerName || !selectionState.pageName) {
      return;
    }

    var rootController = getRootControllerComponent(false);
    if (rootController) {
      var activeControllerName = rootController.getActiveControllerName
        ? (rootController.getActiveControllerName() || '')
        : (rootController.previewController || '');
      var activePageId = rootController.getActivePageId
        ? (rootController.getActivePageId() || '')
        : '';
      var activePageName = rootController.getActivePageName
        ? (rootController.getActivePageName() || '')
        : (rootController.previewPage || '');

      if (
        activeControllerName !== selectionState.controllerName
        || (
          selectionState.pageName !== activePageId
          && selectionState.pageName !== activePageName
        )
      ) {
        return;
      }
    }

    gear.controllerName = selectionState.controllerName || '';
    var states = Array.isArray(gear.states) ? gear.states.slice() : [];
    var currentValue = sprite.spriteFrame || null;
    var matched = false;
    for (var i = 0; i < states.length; i++) {
      if (states[i] && states[i].page === selectionState.pageName) {
        if ((states[i].spriteFrame || null) !== currentValue) {
          states[i].spriteFrame = currentValue;
          gear.states = states;
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      states.push(createImageState(selectionState.pageName, currentValue));
      gear.states = states;
    }
  }

  function saveTextForSelection(node, selectionState) {
    if (!node || !selectionState || !selectionState.controllerName || !selectionState.pageName) {
      return;
    }

    var gear = getPropertyTextGear(node);
    var label = node.getComponent(cc.Label);
    if (!gear || !label) {
      return;
    }

    if (!gear.targetLabel) {
      gear.targetLabel = label;
    }
    if (!gear.defaultValue) {
      gear.defaultValue = label.string || '';
    }

    gear.controllerName = selectionState.controllerName || '';
    var states = Array.isArray(gear.states) ? gear.states.slice() : [];
    var matched = false;
    for (var i = 0; i < states.length; i++) {
      if (states[i] && states[i].page === selectionState.pageName) {
        states[i].value = label.string || '';
        matched = true;
        break;
      }
    }

    if (!matched) {
      states.push(createTextState(selectionState.pageName, label.string || ''));
    }

    gear.states = states;
  }

  function initializeTextGearStates(node, controllerName) {
    if (!node || !controllerName) {
      return;
    }

    var gear = getPropertyTextGear(node);
    var label = node.getComponent(cc.Label);
    if (!gear || !label) {
      return;
    }

    var controllers = window.__fairyControllerToolbarState.controllers || [];
    var pages = [];
    for (var i = 0; i < controllers.length; i++) {
      if (controllers[i] && controllers[i].name === controllerName) {
        pages = Array.isArray(controllers[i].pages) ? controllers[i].pages : [];
        break;
      }
    }

    var currentStates = Array.isArray(gear.states) ? gear.states.slice() : [];
    var nextStates = [];
    for (var j = 0; j < pages.length; j++) {
      var pageRef = getPageOptionValue(pages[j], j);
      var existing = getTextStateForPage(gear, pageRef);
      nextStates.push(createTextState(
        pageRef,
        existing && typeof existing.value === 'string' ? existing.value : (label.string || '')
      ));
    }

    gear.controllerName = controllerName || '';
    if (!gear.targetLabel) {
      gear.targetLabel = label;
    }
    if (!gear.defaultValue) {
      gear.defaultValue = label.string || '';
    }
    if (pages.length) {
      gear.states = nextStates;
      return;
    }

    gear.states = currentStates;
  }

  function saveColorForSelection(node, selectionState) {
    if (!node || !selectionState || !selectionState.controllerName || !selectionState.pageName) {
      return;
    }

    var gear = getPropertyColorGear(node);
    if (!gear) {
      return;
    }

    gear.controllerName = selectionState.controllerName || '';
    var states = Array.isArray(gear.states) ? gear.states.slice() : [];
    var matched = false;
    for (var i = 0; i < states.length; i++) {
      if (states[i] && states[i].page === selectionState.pageName) {
        states[i].color = cloneColorValue(node.color);
        matched = true;
        break;
      }
    }

    if (!matched) {
      states.push(createColorState(selectionState.pageName, node.color));
    }

    gear.states = states;
  }

  function initializeColorGearStates(node, controllerName) {
    if (!node || !controllerName) {
      return;
    }

    var gear = getPropertyColorGear(node);
    if (!gear) {
      return;
    }

    var controllers = window.__fairyControllerToolbarState.controllers || [];
    var pages = [];
    for (var i = 0; i < controllers.length; i++) {
      if (controllers[i] && controllers[i].name === controllerName) {
        pages = Array.isArray(controllers[i].pages) ? controllers[i].pages : [];
        break;
      }
    }

    var currentStates = Array.isArray(gear.states) ? gear.states.slice() : [];
    var nextStates = [];
    for (var j = 0; j < pages.length; j++) {
      var pageRef = getPageOptionValue(pages[j], j);
      var existing = getColorStateForPage(gear, pageRef);
      nextStates.push(createColorState(
        pageRef,
        existing && existing.color ? existing.color : node.color
      ));
    }

    gear.controllerName = controllerName || '';
    if (!gear.defaultColor) {
      gear.defaultColor = cloneColorValue(node.color);
    }
    if (pages.length) {
      gear.states = nextStates;
      return;
    }

    gear.states = currentStates;
  }

  function saveSizeForSelection(node, selectionState) {
    if (!node || !selectionState || !selectionState.controllerName || !selectionState.pageName) {
      return;
    }

    var gear = getPropertySizeGear(node);
    if (!gear) {
      return;
    }

    gear.controllerName = selectionState.controllerName || '';
    var states = Array.isArray(gear.states) ? gear.states.slice() : [];
    var currentValue = readNodeSizeValue(node);
    var matched = false;
    for (var i = 0; i < states.length; i++) {
      if (states[i] && states[i].page === selectionState.pageName) {
        states[i].width = currentValue.width;
        states[i].height = currentValue.height;
        states[i].scaleX = currentValue.scaleX;
        states[i].scaleY = currentValue.scaleY;
        matched = true;
        break;
      }
    }

    if (!matched) {
      states.push(createSizeState(selectionState.pageName, currentValue));
    }

    gear.states = states;
  }

  function initializeSizeGearStates(node, controllerName) {
    if (!node || !controllerName) {
      return;
    }

    var gear = getPropertySizeGear(node);
    if (!gear) {
      return;
    }

    var controllers = window.__fairyControllerToolbarState.controllers || [];
    var pages = [];
    for (var i = 0; i < controllers.length; i++) {
      if (controllers[i] && controllers[i].name === controllerName) {
        pages = Array.isArray(controllers[i].pages) ? controllers[i].pages : [];
        break;
      }
    }

    var currentStates = Array.isArray(gear.states) ? gear.states.slice() : [];
    var nextStates = [];
    var nodeValue = readNodeSizeValue(node);
    for (var j = 0; j < pages.length; j++) {
      var pageRef = getPageOptionValue(pages[j], j);
      var existing = getSizeStateForPage(gear, pageRef);
      nextStates.push(createSizeState(
        pageRef,
        existing ? existing : nodeValue
      ));
    }

    gear.controllerName = controllerName || '';
    if (!gear.targetNode) {
      gear.targetNode = node;
    }
    gear.defaultWidth = nodeValue.width;
    gear.defaultHeight = nodeValue.height;
    gear.defaultScaleX = nodeValue.scaleX;
    gear.defaultScaleY = nodeValue.scaleY;
    if (pages.length) {
      gear.states = nextStates;
      return;
    }

    gear.states = currentStates;
  }

  function saveFontSizeForSelection(node, selectionState) {
    if (!node || !selectionState || !selectionState.controllerName || !selectionState.pageName) {
      return;
    }

    var gear = getPropertyFontSizeGear(node);
    var textComponent = node.getComponent(cc.Label) || (cc.RichText ? node.getComponent(cc.RichText) : null);
    if (!gear || !textComponent) {
      return;
    }

    gear.controllerName = selectionState.controllerName || '';
    var states = Array.isArray(gear.states) ? gear.states.slice() : [];
    var matched = false;
    for (var i = 0; i < states.length; i++) {
      if (states[i] && states[i].page === selectionState.pageName) {
        states[i].value = textComponent.fontSize || 0;
        matched = true;
        break;
      }
    }

    if (!matched) {
      states.push(createFontSizeState(selectionState.pageName, textComponent.fontSize || 0));
    }

    gear.states = states;
  }

  function initializeFontSizeGearStates(node, controllerName) {
    if (!node || !controllerName) {
      return;
    }

    var gear = getPropertyFontSizeGear(node);
    var textComponent = node.getComponent(cc.Label) || (cc.RichText ? node.getComponent(cc.RichText) : null);
    if (!gear || !textComponent) {
      return;
    }

    var controllers = window.__fairyControllerToolbarState.controllers || [];
    var pages = [];
    for (var i = 0; i < controllers.length; i++) {
      if (controllers[i] && controllers[i].name === controllerName) {
        pages = Array.isArray(controllers[i].pages) ? controllers[i].pages : [];
        break;
      }
    }

    var currentStates = Array.isArray(gear.states) ? gear.states.slice() : [];
    var nextStates = [];
    for (var j = 0; j < pages.length; j++) {
      var pageRef = getPageOptionValue(pages[j], j);
      var existing = getFontSizeStateForPage(gear, pageRef);
      nextStates.push(createFontSizeState(
        pageRef,
        existing && typeof existing.value === 'number' ? existing.value : (textComponent.fontSize || 0)
      ));
    }

    gear.controllerName = controllerName || '';
    if (!gear.defaultValue) {
      gear.defaultValue = textComponent.fontSize || 0;
    }
    if (pages.length) {
      gear.states = nextStates;
      return;
    }

    gear.states = currentStates;
  }

  function saveImageForSelection(node, selectionState) {
    if (!node || !selectionState || !selectionState.controllerName || !selectionState.pageName) {
      return;
    }

    var gear = getPropertyImageGear(node);
    var sprite = node.getComponent(cc.Sprite);
    if (!gear || !sprite) {
      return;
    }

    gear.controllerName = selectionState.controllerName || '';
    var states = Array.isArray(gear.states) ? gear.states.slice() : [];
    var currentValue = sprite.spriteFrame || null;
    var matched = false;
    for (var i = 0; i < states.length; i++) {
      if (states[i] && states[i].page === selectionState.pageName) {
        states[i].spriteFrame = currentValue;
        matched = true;
        break;
      }
    }

    if (!matched) {
      states.push(createImageState(selectionState.pageName, currentValue));
    }

    gear.states = states;
  }

  function initializeImageGearStates(node, controllerName) {
    if (!node || !controllerName) {
      return;
    }

    var gear = getPropertyImageGear(node);
    var sprite = node.getComponent(cc.Sprite);
    if (!gear || !sprite) {
      return;
    }

    var controllers = window.__fairyControllerToolbarState.controllers || [];
    var pages = [];
    for (var i = 0; i < controllers.length; i++) {
      if (controllers[i] && controllers[i].name === controllerName) {
        pages = Array.isArray(controllers[i].pages) ? controllers[i].pages : [];
        break;
      }
    }

    var currentStates = Array.isArray(gear.states) ? gear.states.slice() : [];
    var nextStates = [];
    var currentSpriteFrame = sprite.spriteFrame || null;
    for (var j = 0; j < pages.length; j++) {
      var pageRef = getPageOptionValue(pages[j], j);
      var existing = getImageStateForPage(gear, pageRef);
      nextStates.push(createImageState(
        pageRef,
        existing ? (existing.spriteFrame || null) : currentSpriteFrame
      ));
    }

    gear.controllerName = controllerName || '';
    if (!gear.targetSprite) {
      gear.targetSprite = sprite;
    }
    if (!gear.defaultSpriteFrame) {
      gear.defaultSpriteFrame = currentSpriteFrame;
    }
    if (pages.length) {
      gear.states = nextStates;
      return;
    }

    gear.states = currentStates;
  }

  function getPageOptionValue(page, index) {
    if (!page) {
      return '';
    }

    if (page.id) {
      return page.id;
    }

    if (page.name) {
      return page.name;
    }

    return 'page-' + index;
  }

  function getPageOptionLabel(page, index) {
    if (!page) {
      return String(index);
    }

    return page.name || String(index);
  }

  function getPageIndexForController(controllerName, pageRef) {
    var controllers = window.__fairyControllerToolbarState.controllers || [];
    for (var i = 0; i < controllers.length; i++) {
      var controller = controllers[i];
      if (!controller || controller.name !== controllerName) {
        continue;
      }

      var pages = controller.pages || [];
      for (var j = 0; j < pages.length; j++) {
        var optionValue = getPageOptionValue(pages[j], j);
        if (optionValue === pageRef || ((pages[j] && pages[j].name) || '') === pageRef) {
          return j;
        }
      }
      return -1;
    }
    return -1;
  }

  function getBindingPageRef(controllerName, binding) {
    if (!binding || !binding.values || !binding.values.visiblePages || !binding.values.visiblePages.length) {
      return '';
    }

    var pageIndex = binding.values.visiblePages[0];
    var controllers = window.__fairyControllerToolbarState.controllers || [];
    for (var i = 0; i < controllers.length; i++) {
      var controller = controllers[i];
      if (!controller || controller.name !== controllerName) {
        continue;
      }

      var pages = controller.pages || [];
      if (pageIndex >= 0 && pageIndex < pages.length) {
        return getPageOptionValue(pages[pageIndex], pageIndex);
      }
      return '';
    }

    return '';
  }

  function applyDisplayBindingConfig(config) {
    var node = getSelectedNode();
    if (!node) {
      logPropertyControl('apply-skip-no-node');
      return;
    }

    var rootComponent = getRootControllerComponent(true);
    var rootNode = rootComponent ? rootComponent.node : null;
    if (!rootComponent || !rootNode) {
      logPropertyControl('apply-skip-no-root-controller', {
        nodeName: node.name || '',
      });
      return;
    }

    var conditions = Array.isArray(config && config.conditions) ? config.conditions : [];
    var normalizedConditions = [];
    for (var i = 0; i < conditions.length; i++) {
      var normalizedCondition = normalizeDisplayCondition(conditions[i]);
      if (normalizedCondition) {
        normalizedConditions.push(normalizedCondition);
      }
    }

    var bindings = safeParseBindings(rootComponent.bindingsJson || '[]');
    var nodePath = getNodePathFromRoot(rootNode, node);
    var nodeUuid = node.uuid || node._id || '';
    var bindingIndex = -1;
    for (var j = 0; j < bindings.length; j++) {
      var currentBinding = bindings[j];
      if (!currentBinding || currentBinding.type !== 'display') {
        continue;
      }
      if (currentBinding.nodePath === nodePath || (nodeUuid && currentBinding.nodeUuid === nodeUuid)) {
        bindingIndex = j;
        break;
      }
    }

    if (!normalizedConditions.length) {
      if (bindingIndex >= 0) {
        bindings.splice(bindingIndex, 1);
      }
      setPropertySelectionState(node, '', '');
    }
    else {
      var nextBinding = bindingIndex >= 0 ? bindings[bindingIndex] : null;
      nextBinding = nextBinding || {
        id: 'binding-' + Date.now(),
        nodePath: nodePath,
        nodeUuid: nodeUuid,
        controllerName: normalizedConditions[0].controllerName || '',
        type: 'display',
        values: {
          visiblePages: [],
        },
      };
      nextBinding.nodePath = nodePath;
      nextBinding.nodeUuid = nodeUuid;
      nextBinding.controllerName = normalizedConditions[0].controllerName || '';
      nextBinding.type = 'display';
      nextBinding.values = {
        visiblePages: normalizedConditions[0].visiblePages.slice(),
        conditions: normalizedConditions,
        mode: config && config.mode === 'and' ? 'and' : 'or',
      };

      if (bindingIndex >= 0) {
        bindings[bindingIndex] = nextBinding;
      }
      else {
        bindings.push(nextBinding);
      }

      var primaryPageName = getPageRefByIndex(
        normalizedConditions[0].controllerName || '',
        normalizedConditions[0].visiblePages[0]
      );
      setPropertySelectionState(
        node,
        normalizedConditions[0].controllerName || '',
        primaryPageName || ''
      );
    }

    if (rootComponent.updateBindings) {
      rootComponent.updateBindings(bindings);
    }
    else {
      rootComponent.bindingsJson = JSON.stringify(bindings, null, 2);
      if (rootComponent.applyAll) {
        rootComponent.applyAll();
      }
      else if (rootComponent.applyPreview) {
        rootComponent.applyPreview();
      }
    }
  }

  function logPropertyControl(step, payload) {
    try {
      var serialized = '';
      try {
        serialized = JSON.stringify(payload || {});
      }
      catch (error) {
        serialized = String(payload || '');
      }
      console.log('[fairy-controller-editor][property-control][' + step + '] ' + serialized);
    }
    catch (error) {}
  }

  function getNodeStateKey(node) {
    if (!node) {
      return '';
    }

    var directUuid = node.uuid || '';
    if (directUuid) {
      return directUuid;
    }

    var directId = node._id || '';
    if (directId) {
      return directId;
    }

    var names = [];
    var current = node;
    while (current) {
      names.unshift(current.name || '');
      current = current.parent || null;
    }
    return names.join('/');
  }

  function getPropertySelectionState(node) {
    var key = getNodeStateKey(node);
    if (!key) {
      return null;
    }

    var store = window.__fairyControllerPropertySelectionState || {};
    return store[key] || null;
  }

  function setPropertySelectionState(node, controllerName, pageName) {
    var key = getNodeStateKey(node);
    if (!key) {
      return;
    }

    window.__fairyControllerPropertySelectionState = window.__fairyControllerPropertySelectionState || {};
    window.__fairyControllerPropertySelectionState[key] = {
      controllerName: controllerName || '',
      pageName: pageName || '',
    };

    logPropertyControl('set-selection-state', {
      key: key,
      nodeName: node ? (node.name || '') : '',
      controllerName: controllerName || '',
      pageName: pageName || '',
    });
  }

  function getPropertyControlSignature() {
    syncStateFromSelection();

    var controllers = window.__fairyControllerToolbarState.controllers || [];
    var selectedNode = getSelectedNode();
    syncTextGearStateFromLabel(selectedNode);
    syncColorGearStateFromNode(selectedNode);
    syncSizeGearStateFromNode(selectedNode);
    syncFontSizeGearStateFromNode(selectedNode);
    syncImageGearStateFromNode(selectedNode);
    var rootComponent = getRootControllerComponent(false);
    var rootNode = rootComponent ? rootComponent.node : null;
    var binding = getDisplayBinding(rootComponent, rootNode, selectedNode);
    var bindingConditions = getDisplayBindingConditions(binding);
    var bindingMode = getDisplayBindingMode(binding);
    var selectionState = getPropertySelectionState(selectedNode);
    if (selectionState && !hasControllerName(selectionState.controllerName || '')) {
      selectionState = null;
    }
    var textGear = getPropertyTextGear(selectedNode);
    var textSelectionState = getEffectiveTextSelectionState(selectedNode, textGear);
    var colorGear = getPropertyColorGear(selectedNode);
    var colorSelectionState = getEffectiveColorSelectionState(selectedNode, colorGear);
    var sizeGear = getPropertySizeGear(selectedNode);
    var sizeSelectionState = getEffectiveSizeSelectionState(selectedNode, sizeGear);
    var fontSizeGear = getPropertyFontSizeGear(selectedNode);
    var fontSizeSelectionState = getEffectiveFontSizeSelectionState(selectedNode, fontSizeGear);
    var label = selectedNode ? selectedNode.getComponent(cc.Label) : null;
    var selectedPage = selectionState
      ? (selectionState.pageName || '')
      : getBindingPageRef(binding ? binding.controllerName || '' : '', binding);
    var selectedController = selectionState
      ? (selectionState.controllerName || '')
      : (binding ? (binding.controllerName || '') : '');

    return JSON.stringify({
      selectedNodeUuid: selectedNode ? (selectedNode.uuid || '') : '',
      controllers: controllers,
      bindingsJson: rootComponent ? (rootComponent.bindingsJson || '[]') : '[]',
      bindingControllerName: selectedController,
      bindingPage: selectedPage,
      textGearControllerName: textGear ? (textGear.controllerName || '') : '',
      textGearStates: textGear && Array.isArray(textGear.states)
        ? textGear.states.map(function (state) {
          return {
            page: state && state.page ? state.page : '',
            value: state && typeof state.value === 'string' ? state.value : '',
          };
        })
        : [],
      textSelectionControllerName: textSelectionState ? (textSelectionState.controllerName || '') : '',
      textSelectionPage: textSelectionState ? (textSelectionState.pageName || '') : '',
      colorGearControllerName: colorGear ? (colorGear.controllerName || '') : '',
      colorGearStates: colorGear && Array.isArray(colorGear.states)
        ? colorGear.states.map(function (state) {
          return {
            page: state && state.page ? state.page : '',
            color: serializeColorValue(state && state.color ? state.color : null),
          };
        })
        : [],
      colorSelectionControllerName: colorSelectionState ? (colorSelectionState.controllerName || '') : '',
      colorSelectionPage: colorSelectionState ? (colorSelectionState.pageName || '') : '',
      sizeGearControllerName: sizeGear ? (sizeGear.controllerName || '') : '',
      sizeGearStates: sizeGear && Array.isArray(sizeGear.states)
        ? sizeGear.states.map(function (state) {
          return {
            page: state && state.page ? state.page : '',
            width: state && typeof state.width === 'number' ? state.width : 0,
            height: state && typeof state.height === 'number' ? state.height : 0,
            scaleX: state && typeof state.scaleX === 'number' ? state.scaleX : 1,
            scaleY: state && typeof state.scaleY === 'number' ? state.scaleY : 1,
          };
        })
        : [],
      sizeSelectionControllerName: sizeSelectionState ? (sizeSelectionState.controllerName || '') : '',
      sizeSelectionPage: sizeSelectionState ? (sizeSelectionState.pageName || '') : '',
      fontSizeGearControllerName: fontSizeGear ? (fontSizeGear.controllerName || '') : '',
      fontSizeGearStates: fontSizeGear && Array.isArray(fontSizeGear.states)
        ? fontSizeGear.states.map(function (state) {
          return {
            page: state && state.page ? state.page : '',
            value: state && typeof state.value === 'number' ? state.value : 0,
          };
        })
        : [],
      fontSizeSelectionControllerName: fontSizeSelectionState ? (fontSizeSelectionState.controllerName || '') : '',
      fontSizeSelectionPage: fontSizeSelectionState ? (fontSizeSelectionState.pageName || '') : '',
      labelText: label ? (label.string || '') : '',
      nodeColor: selectedNode ? serializeColorValue(selectedNode.color) : null,
      nodeSize: selectedNode ? serializeSizeValue(readNodeSizeValue(selectedNode)) : null,
      nodeFontSize: label ? (label.fontSize || 0) : ((selectedNode && cc.RichText && selectedNode.getComponent(cc.RichText)) ? ((selectedNode.getComponent(cc.RichText).fontSize) || 0) : 0),
    });
  }

  function ensurePropertyControlRoot() {
    var root = window.__fairyControllerPropertyControlRoot || null;
    if (root) {
      return root;
    }

    root = document.createElement('ui-section');
    root.id = 'fairy-controller-property-control';
    root.setAttribute('header', '属性控制');
    root.setAttribute('expand', '');
    root.style.display = 'none';
    root.style.marginTop = '8px';
    root.style.boxSizing = 'border-box';
    root.style.color = '#c9c9c9';
    root.style.width = '100%';
    root.style.flex = '0 0 auto';
    window.__fairyControllerPropertyControlRoot = root;
    return root;
  }

  function ensureDisplayGear(node) {
    if (!node) {
      return null;
    }

    var gear = getPropertyGear(node);
    if (!gear) {
      gear = node.addComponent('UIControllerGearDisplay');
      if (gear) {
        gear.controllerName = '';
        gear.pages = [];
      }
    }
    return gear || null;
  }

  function ensureTextGear(node) {
    if (!node) {
      return null;
    }

    var gear = getPropertyTextGear(node);
    if (!gear) {
      gear = node.addComponent('UIControllerGearText');
      if (gear) {
        gear.controllerName = '';
      }
    }
    return gear || null;
  }

  function ensureColorGear(node) {
    if (!node) {
      return null;
    }

    var gear = getPropertyColorGear(node);
    if (!gear) {
      gear = node.addComponent('UIControllerGearColor');
      if (gear) {
        gear.controllerName = '';
        gear.defaultColor = cloneColorValue(node.color);
      }
    }
    return gear || null;
  }

  function ensureSizeGear(node) {
    if (!node) {
      return null;
    }

    var gear = getPropertySizeGear(node);
    if (!gear) {
      gear = node.addComponent('UIControllerGearSize');
      if (gear) {
        gear.controllerName = '';
        gear.targetNode = node;
        gear.defaultWidth = node.width;
        gear.defaultHeight = node.height;
        gear.defaultScaleX = node.scaleX;
        gear.defaultScaleY = node.scaleY;
      }
    }
    return gear || null;
  }

  function ensureFontSizeGear(node) {
    if (!node) {
      return null;
    }

    var gear = getPropertyFontSizeGear(node);
    var textComponent = node.getComponent(cc.Label) || (cc.RichText ? node.getComponent(cc.RichText) : null);
    if (!gear) {
      gear = node.addComponent('UIControllerGearFontSize');
      if (gear) {
        gear.controllerName = '';
        gear.defaultValue = textComponent ? (textComponent.fontSize || 0) : 0;
      }
    }
    return gear || null;
  }

  function ensureImageGear(node) {
    if (!node) {
      return null;
    }

    var gear = getPropertyImageGear(node);
    var sprite = node.getComponent(cc.Sprite);
    if (!gear) {
      gear = node.addComponent('UIControllerGearImage');
      if (gear) {
        gear.controllerName = '';
        gear.targetSprite = sprite || null;
        gear.defaultSpriteFrame = sprite ? (sprite.spriteFrame || null) : null;
      }
    }
    return gear || null;
  }

  function removeTextGear(node) {
    if (!node) {
      return false;
    }

    var gear = getPropertyTextGear(node);
    if (!gear) {
      return false;
    }

    if (gear.destroy) {
      gear.destroy();
    }
    return true;
  }

  function removeColorGear(node) {
    if (!node) {
      return false;
    }

    var gear = getPropertyColorGear(node);
    if (!gear) {
      return false;
    }

    if (gear.destroy) {
      gear.destroy();
    }
    return true;
  }

  function removeSizeGear(node) {
    if (!node) {
      return false;
    }

    var gear = getPropertySizeGear(node);
    if (!gear) {
      return false;
    }

    if (gear.destroy) {
      gear.destroy();
    }
    return true;
  }

  function removeFontSizeGear(node) {
    if (!node) {
      return false;
    }

    var gear = getPropertyFontSizeGear(node);
    if (!gear) {
      return false;
    }

    if (gear.destroy) {
      gear.destroy();
    }
    return true;
  }

  function removeImageGear(node) {
    if (!node) {
      return false;
    }

    var gear = getPropertyImageGear(node);
    if (!gear) {
      return false;
    }

    if (gear.destroy) {
      gear.destroy();
    }
    return true;
  }

  function ensurePositionGear(node) {
    if (!node) {
      return null;
    }

    var gear = getPropertyPositionGear(node);
    if (!gear) {
      gear = node.addComponent('UIControllerGearPosition');
      if (gear) {
        gear.controllerName = '';
        gear.targetNode = node;
      }
    }
    return gear || null;
  }

  function hasTextComponent(node) {
    if (!node || !window.cc) {
      return false;
    }

    if (node.getComponent(cc.Label)) {
      return true;
    }

    return !!(cc.RichText && node.getComponent(cc.RichText));
  }

  function hideMoreControlMenu() {
    var menu = window.__fairyControllerMoreControlMenu || null;
    if (menu && menu.parentElement) {
      menu.parentElement.removeChild(menu);
    }
    window.__fairyControllerMoreControlMenu = null;

    if (window.__fairyControllerMoreControlMenuCloseHandler) {
      document.removeEventListener('mousedown', window.__fairyControllerMoreControlMenuCloseHandler, true);
      window.__fairyControllerMoreControlMenuCloseHandler = null;
    }
  }

  function addPropertyGearByType(type) {
    var node = getSelectedNode();
    if (!node) {
      return;
    }

    if (type === 'display') {
      var rootComponent = getRootControllerComponent(false);
      var rootNode = rootComponent ? rootComponent.node : null;
      var currentBinding = getDisplayBinding(rootComponent, rootNode, node);
      var currentConditions = getDisplayBindingConditions(currentBinding);
      if (currentConditions.length >= 2) {
        renderPropertyControl();
        return;
      }

      if (!currentConditions.length) {
        var currentSelection = getPropertySelectionState(node);
        if (currentSelection && currentSelection.controllerName && currentSelection.pageName) {
          currentConditions.push({
            controllerName: currentSelection.controllerName || '',
            pageName: currentSelection.pageName || '',
          });
        }
      }

      if (!currentConditions.length) {
        currentConditions.push(getDefaultDisplayCondition());
      }

      currentConditions.push(getDefaultDisplayCondition());
      applyDisplayBindingConfig({
        conditions: currentConditions,
        mode: getDisplayBindingMode(currentBinding),
      });
      renderPropertyControl();
      return;
    }

    if (type === 'position') {
      ensurePositionGear(node);
      console.log('[fairy-controller-editor][property-control][more-control] added UIControllerGearPosition');
      renderPropertyControl();
      return;
    }

    if (type === 'size') {
      var newSizeGear = ensureSizeGear(node);
      if (newSizeGear) {
        var currentSizeSelection = getSizeSelectionState(node);
        var defaultSizeControllerName = currentSizeSelection && currentSizeSelection.controllerName
          ? currentSizeSelection.controllerName
          : ((window.__fairyControllerToolbarState.controllers || [])[0] && (window.__fairyControllerToolbarState.controllers || [])[0].name || '');
        initializeSizeGearStates(node, defaultSizeControllerName);
      }
      console.log('[fairy-controller-editor][property-control][more-control] added UIControllerGearSize');
      renderPropertyControl();
      return;
    }

    if (type === 'font-size') {
      if (!hasTextComponent(node)) {
        console.warn('[fairy-controller-editor][property-control][more-control] 字体大小控制需要节点上有 Label 或 RichText 组件');
        return;
      }
      var newFontSizeGear = ensureFontSizeGear(node);
      if (newFontSizeGear) {
        var currentFontSizeSelection = getFontSizeSelectionState(node);
        var defaultFontSizeControllerName = currentFontSizeSelection && currentFontSizeSelection.controllerName
          ? currentFontSizeSelection.controllerName
          : ((window.__fairyControllerToolbarState.controllers || [])[0] && (window.__fairyControllerToolbarState.controllers || [])[0].name || '');
        initializeFontSizeGearStates(node, defaultFontSizeControllerName);
      }
      console.log('[fairy-controller-editor][property-control][more-control] added UIControllerGearFontSize');
      renderPropertyControl();
      return;
    }

    if (type === 'image') {
      if (!node.getComponent(cc.Sprite)) {
        console.warn('[fairy-controller-editor][property-control][more-control] 图片控制需要节点上有 Sprite 组件');
        return;
      }
      var newImageGear = ensureImageGear(node);
      if (newImageGear) {
        var currentImageSelection = getImageSelectionState(node);
        var defaultImageControllerName = currentImageSelection && currentImageSelection.controllerName
          ? currentImageSelection.controllerName
          : ((window.__fairyControllerToolbarState.controllers || [])[0] && (window.__fairyControllerToolbarState.controllers || [])[0].name || '');
        initializeImageGearStates(node, defaultImageControllerName);
      }
      console.log('[fairy-controller-editor][property-control][more-control] added UIControllerGearImage');
      renderPropertyControl();
      return;
    }

    if (type === 'color') {
      var newColorGear = ensureColorGear(node);
      if (newColorGear) {
        var currentColorSelection = getColorSelectionState(node);
        var defaultColorControllerName = currentColorSelection && currentColorSelection.controllerName
          ? currentColorSelection.controllerName
          : ((window.__fairyControllerToolbarState.controllers || [])[0] && (window.__fairyControllerToolbarState.controllers || [])[0].name || '');
        initializeColorGearStates(node, defaultColorControllerName);
      }
      console.log('[fairy-controller-editor][property-control][more-control] added UIControllerGearColor');
      renderPropertyControl();
      return;
    }

    if (type === 'text') {
      if (!hasTextComponent(node)) {
        console.warn('[fairy-controller-editor][property-control][more-control] 文本控制需要节点上有 Label 或 RichText 组件');
        return;
      }
      var newTextGear = ensureTextGear(node);
      if (newTextGear) {
        var currentSelection = getTextSelectionState(node);
        var defaultControllerName = currentSelection && currentSelection.controllerName
          ? currentSelection.controllerName
          : ((window.__fairyControllerToolbarState.controllers || [])[0] && (window.__fairyControllerToolbarState.controllers || [])[0].name || '');
        initializeTextGearStates(node, defaultControllerName);
      }
      console.log('[fairy-controller-editor][property-control][more-control] added UIControllerGearText');
      renderPropertyControl();
      return;
    }

    console.warn('[fairy-controller-editor][property-control][more-control] 暂未实现: ' + type);
  }

  function showMoreControlMenu(anchorButton) {
    hideMoreControlMenu();

    if (!anchorButton) {
      return;
    }

    var menu = document.createElement('div');
    menu.style.position = 'fixed';
    menu.style.minWidth = '220px';
    menu.style.background = '#f1f1f1';
    menu.style.color = '#222';
    menu.style.border = '1px solid #8f8f8f';
    menu.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.25)';
    menu.style.zIndex = '999999';
    menu.style.padding = '6px 0';
    menu.style.boxSizing = 'border-box';
    menu.style.maxHeight = 'calc(100vh - 16px)';
    menu.style.overflowY = 'auto';

    var items = [
      { label: '显示-2', type: 'display' },
      { label: '位置(X/Y)', type: 'position' },
      { label: '大小(宽/高/ScaleX/ScaleY)', type: 'size' },
      { label: '字体大小', type: 'font-size' },
      { label: '颜色', type: 'color' },
      { label: '外观(透明度/旋转/变灰/不可触摸)', type: 'look' },
      { label: '文本', type: 'text' },
      { label: '图片', type: 'image' },
    ];

    var selectedNode = getSelectedNode();
    if (!hasTextComponent(selectedNode)) {
      items = items.filter(function (item) {
        return item.type !== 'text' && item.type !== 'font-size';
      });
    }
    if (!selectedNode || !selectedNode.getComponent(cc.Sprite)) {
      items = items.filter(function (item) {
        return item.type !== 'image';
      });
    }

    for (var i = 0; i < items.length; i++) {
      (function (item) {
        var entry = document.createElement('div');
        entry.textContent = item.label;
        entry.style.padding = '6px 18px';
        entry.style.cursor = 'pointer';
        entry.style.fontSize = '12px';
        entry.style.lineHeight = '20px';
        entry.style.userSelect = 'none';
        entry.addEventListener('mouseenter', function () {
          entry.style.background = '#cfe4ff';
        });
        entry.addEventListener('mouseleave', function () {
          entry.style.background = 'transparent';
        });
        entry.addEventListener('mousedown', function (event) {
          event.preventDefault();
          event.stopPropagation();
          hideMoreControlMenu();
          addPropertyGearByType(item.type);
        });
        menu.appendChild(entry);
      })(items[i]);
    }

    document.body.appendChild(menu);
    var rect = anchorButton.getBoundingClientRect();
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    var menuRect = menu.getBoundingClientRect();
    var left = Math.round(rect.left);
    var top = Math.round(rect.bottom + 4);
    var margin = 8;

    if (left + menuRect.width + margin > viewportWidth) {
      left = Math.max(margin, Math.round(viewportWidth - menuRect.width - margin));
    }

    if (top + menuRect.height + margin > viewportHeight) {
      var aboveTop = Math.round(rect.top - menuRect.height - 4);
      if (aboveTop >= margin) {
        top = aboveTop;
      }
      else {
        top = Math.max(margin, Math.round(viewportHeight - menuRect.height - margin));
      }
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    var closeHandler = function (event) {
      if (!menu.contains(event.target) && event.target !== anchorButton) {
        hideMoreControlMenu();
      }
    };
    document.addEventListener('mousedown', closeHandler, true);
    window.__fairyControllerMoreControlMenuCloseHandler = closeHandler;
    window.__fairyControllerMoreControlMenu = menu;
  }

  function applyPropertyGear(controllerName, pageName) {
    applyDisplayBindingConfig({
      conditions: controllerName && pageName ? [{
        controllerName: controllerName || '',
        pageName: pageName || '',
      }] : [],
      mode: 'or',
    });
  }

  function applyTextPropertyGear(controllerName, pageName) {
    var node = getSelectedNode();
    if (!node) {
      return;
    }

    var gear = ensureTextGear(node);
    var label = node.getComponent(cc.Label);
    if (!gear || !label) {
      return;
    }

    setTextSelectionState(node, controllerName || '', pageName || '');

    if (!gear.targetLabel) {
      gear.targetLabel = label;
    }
    if (!gear.defaultValue) {
      gear.defaultValue = label.string || '';
    }

    gear.controllerName = controllerName || '';
    var rootController = getRootControllerComponent(false);
    if (rootController) {
      if (rootController.setPreview) {
        rootController.setPreview(controllerName || '', pageName || '');
      }
      else {
        rootController.previewController = controllerName || '';
        rootController.previewPage = pageName || '';
        if (rootController.applyAll) {
          rootController.applyAll();
        }
      }
    }
    if (gear.apply) {
      gear.apply();
    }
  }

  function applyColorPropertyGear(controllerName, pageName) {
    var node = getSelectedNode();
    if (!node) {
      return;
    }

    var gear = ensureColorGear(node);
    if (!gear) {
      return;
    }

    setColorSelectionState(node, controllerName || '', pageName || '');

    gear.controllerName = controllerName || '';
    if (!gear.defaultColor) {
      gear.defaultColor = cloneColorValue(node.color);
    }

    var rootController = getRootControllerComponent(false);
    if (rootController) {
      if (rootController.setPreview) {
        rootController.setPreview(controllerName || '', pageName || '');
      }
      else {
        rootController.previewController = controllerName || '';
        rootController.previewPage = pageName || '';
        if (rootController.applyAll) {
          rootController.applyAll();
        }
      }
    }
    if (gear.apply) {
      gear.apply();
    }
  }

  function applySizePropertyGear(controllerName, pageName) {
    var node = getSelectedNode();
    if (!node) {
      return;
    }

    var gear = ensureSizeGear(node);
    if (!gear) {
      return;
    }

    setSizeSelectionState(node, controllerName || '', pageName || '');

    gear.controllerName = controllerName || '';
    if (!gear.targetNode) {
      gear.targetNode = node;
    }

    var rootController = getRootControllerComponent(false);
    if (rootController) {
      if (rootController.setPreview) {
        rootController.setPreview(controllerName || '', pageName || '');
      }
      else {
        rootController.previewController = controllerName || '';
        rootController.previewPage = pageName || '';
        if (rootController.applyAll) {
          rootController.applyAll();
        }
      }
    }
    if (gear.apply) {
      gear.apply();
    }
  }

  function applyFontSizePropertyGear(controllerName, pageName) {
    var node = getSelectedNode();
    if (!node) {
      return;
    }

    var gear = ensureFontSizeGear(node);
    if (!gear) {
      return;
    }

    setFontSizeSelectionState(node, controllerName || '', pageName || '');
    gear.controllerName = controllerName || '';

    var textComponent = node.getComponent(cc.Label) || (cc.RichText ? node.getComponent(cc.RichText) : null);
    if (textComponent && !gear.defaultValue) {
      gear.defaultValue = textComponent.fontSize || 0;
    }

    var rootController = getRootControllerComponent(false);
    if (rootController) {
      if (rootController.setPreview) {
        rootController.setPreview(controllerName || '', pageName || '');
      }
      else {
        rootController.previewController = controllerName || '';
        rootController.previewPage = pageName || '';
        if (rootController.applyAll) {
          rootController.applyAll();
        }
      }
    }
    if (gear.apply) {
      gear.apply();
    }
  }

  function applyImagePropertyGear(controllerName, pageName) {
    var node = getSelectedNode();
    if (!node) {
      return;
    }

    var gear = ensureImageGear(node);
    var sprite = node.getComponent(cc.Sprite);
    if (!gear || !sprite) {
      return;
    }

    setImageSelectionState(node, controllerName || '', pageName || '');
    gear.controllerName = controllerName || '';

    if (!gear.targetSprite) {
      gear.targetSprite = sprite;
    }
    if (!gear.defaultSpriteFrame) {
      gear.defaultSpriteFrame = sprite.spriteFrame || null;
    }

    var rootController = getRootControllerComponent(false);
    if (rootController) {
      if (rootController.setPreview) {
        rootController.setPreview(controllerName || '', pageName || '');
      }
      else {
        rootController.previewController = controllerName || '';
        rootController.previewPage = pageName || '';
        if (rootController.applyAll) {
          rootController.applyAll();
        }
      }
    }
    if (gear.apply) {
      gear.apply();
    }
  }

  function renderPropertyControl() {
    var root = ensurePropertyControlRoot();
    var insertTarget = findInspectorInsertTarget();
    var selectedNode = getSelectedNode();
    syncStateFromSelection();

    var controllers = window.__fairyControllerToolbarState.controllers || [];
    if (!insertTarget || !insertTarget.container || !selectedNode || !controllers.length) {
      root.style.display = 'none';
      if (root.parentElement) {
        root.parentElement.removeChild(root);
      }
      return false;
    }

    if (root.parentElement !== insertTarget.container) {
      if (root.parentElement) {
        root.parentElement.removeChild(root);
      }

      if (insertTarget.anchor) {
        insertTarget.container.insertBefore(root, insertTarget.anchor);
      }
      else {
        insertTarget.container.appendChild(root);
      }
    }
    else if (insertTarget.anchor && root.nextSibling !== insertTarget.anchor) {
      insertTarget.container.insertBefore(root, insertTarget.anchor);
    }

    var rootComponent = getRootControllerComponent(false);
    var rootNode = rootComponent ? rootComponent.node : null;
    var binding = getDisplayBinding(rootComponent, rootNode, selectedNode);
    var bindingConditions = getDisplayBindingConditions(binding);
    var bindingMode = getDisplayBindingMode(binding);
    var selectionState = getPropertySelectionState(selectedNode);
    var textGear = getPropertyTextGear(selectedNode);
    var textSelectionState = getEffectiveTextSelectionState(selectedNode, textGear);
    var colorGear = getPropertyColorGear(selectedNode);
    var colorSelectionState = getEffectiveColorSelectionState(selectedNode, colorGear);
    var sizeGear = getPropertySizeGear(selectedNode);
    var sizeSelectionState = getEffectiveSizeSelectionState(selectedNode, sizeGear);
    var fontSizeGear = getPropertyFontSizeGear(selectedNode);
    var fontSizeSelectionState = getEffectiveFontSizeSelectionState(selectedNode, fontSizeGear);
    var imageGear = getPropertyImageGear(selectedNode);
    var imageSelectionState = getEffectiveImageSelectionState(selectedNode, imageGear);
    var label = selectedNode ? selectedNode.getComponent(cc.Label) : null;
    var controllerName = selectionState
      ? (selectionState.controllerName || '')
      : (bindingConditions[0] ? (bindingConditions[0].controllerName || '') : '');
    var currentController = null;
    for (var i = 0; i < controllers.length; i++) {
      if (controllers[i] && controllers[i].name === controllerName) {
        currentController = controllers[i];
        break;
      }
    }

    var pages = currentController && currentController.pages ? currentController.pages : [];
    var pageName = selectionState
      ? (selectionState.pageName || '')
      : (bindingConditions[0] ? (bindingConditions[0].pageName || '') : '');
    var hasPage = false;
    for (var j = 0; j < pages.length; j++) {
      var optionValue = getPageOptionValue(pages[j], j);
      if (optionValue === pageName || ((pages[j] && pages[j].name) || '') === pageName) {
        hasPage = true;
        break;
      }
    }
    if (!hasPage) {
      pageName = '';
    }

    var textControllerName = textSelectionState
      ? (textSelectionState.controllerName || '')
      : (textGear ? (textGear.controllerName || '') : '');
    var textController = null;
    for (var tc = 0; tc < controllers.length; tc++) {
      if (controllers[tc] && controllers[tc].name === textControllerName) {
        textController = controllers[tc];
        break;
      }
    }

    var textPageName = getResolvedTextPageName(
      textControllerName,
      textSelectionState ? (textSelectionState.pageName || '') : ''
    );
    var colorControllerName = colorSelectionState
      ? (colorSelectionState.controllerName || '')
      : (colorGear ? (colorGear.controllerName || '') : '');
    var colorController = null;
    for (var ccIndex = 0; ccIndex < controllers.length; ccIndex++) {
      if (controllers[ccIndex] && controllers[ccIndex].name === colorControllerName) {
        colorController = controllers[ccIndex];
        break;
      }
    }

    var colorPageName = getResolvedTextPageName(
      colorControllerName,
      colorSelectionState ? (colorSelectionState.pageName || '') : ''
    );
    var sizeControllerName = sizeSelectionState
      ? (sizeSelectionState.controllerName || '')
      : (sizeGear ? (sizeGear.controllerName || '') : '');
    var sizeController = null;
    for (var sizeIndex = 0; sizeIndex < controllers.length; sizeIndex++) {
      if (controllers[sizeIndex] && controllers[sizeIndex].name === sizeControllerName) {
        sizeController = controllers[sizeIndex];
        break;
      }
    }

    var sizePageName = getResolvedTextPageName(
      sizeControllerName,
      sizeSelectionState ? (sizeSelectionState.pageName || '') : ''
    );
    var fontSizeControllerName = fontSizeSelectionState
      ? (fontSizeSelectionState.controllerName || '')
      : (fontSizeGear ? (fontSizeGear.controllerName || '') : '');
    var fontSizeController = null;
    for (var fontSizeIndex = 0; fontSizeIndex < controllers.length; fontSizeIndex++) {
      if (controllers[fontSizeIndex] && controllers[fontSizeIndex].name === fontSizeControllerName) {
        fontSizeController = controllers[fontSizeIndex];
        break;
      }
    }

    var fontSizePageName = getResolvedTextPageName(
      fontSizeControllerName,
      fontSizeSelectionState ? (fontSizeSelectionState.pageName || '') : ''
    );
    var imageControllerName = imageSelectionState
      ? (imageSelectionState.controllerName || '')
      : (imageGear ? (imageGear.controllerName || '') : '');
    var imageController = null;
    for (var imageIndex = 0; imageIndex < controllers.length; imageIndex++) {
      if (controllers[imageIndex] && controllers[imageIndex].name === imageControllerName) {
        imageController = controllers[imageIndex];
        break;
      }
    }

    var imagePageName = getResolvedTextPageName(
      imageControllerName,
      imageSelectionState ? (imageSelectionState.pageName || '') : ''
    );

    if (
      textGear
      && textControllerName
      && textPageName
      && (
        !textSelectionState
        || textSelectionState.controllerName !== textControllerName
        || textSelectionState.pageName !== textPageName
      )
    ) {
      setTextSelectionState(selectedNode, textControllerName, textPageName);
      textSelectionState = {
        controllerName: textControllerName,
        pageName: textPageName,
      };
    }

    if (
      colorGear
      && colorControllerName
      && colorPageName
      && (
        !colorSelectionState
        || colorSelectionState.controllerName !== colorControllerName
        || colorSelectionState.pageName !== colorPageName
      )
    ) {
      setColorSelectionState(selectedNode, colorControllerName, colorPageName);
      colorSelectionState = {
        controllerName: colorControllerName,
        pageName: colorPageName,
      };
    }

    if (
      sizeGear
      && sizeControllerName
      && sizePageName
      && (
        !sizeSelectionState
        || sizeSelectionState.controllerName !== sizeControllerName
        || sizeSelectionState.pageName !== sizePageName
      )
    ) {
      setSizeSelectionState(selectedNode, sizeControllerName, sizePageName);
      sizeSelectionState = {
        controllerName: sizeControllerName,
        pageName: sizePageName,
      };
    }

    if (
      fontSizeGear
      && fontSizeControllerName
      && fontSizePageName
      && (
        !fontSizeSelectionState
        || fontSizeSelectionState.controllerName !== fontSizeControllerName
        || fontSizeSelectionState.pageName !== fontSizePageName
      )
    ) {
      setFontSizeSelectionState(selectedNode, fontSizeControllerName, fontSizePageName);
      fontSizeSelectionState = {
        controllerName: fontSizeControllerName,
        pageName: fontSizePageName,
      };
    }

    if (
      imageGear
      && imageControllerName
      && imagePageName
      && (
        !imageSelectionState
        || imageSelectionState.controllerName !== imageControllerName
        || imageSelectionState.pageName !== imagePageName
      )
    ) {
      setImageSelectionState(selectedNode, imageControllerName, imagePageName);
      imageSelectionState = {
        controllerName: imageControllerName,
        pageName: imagePageName,
      };
    }

    logPropertyControl('render-state', {
      nodeName: selectedNode ? (selectedNode.name || '') : '',
      nodeKey: getNodeStateKey(selectedNode),
      controllerName: controllerName,
      pageName: pageName,
      selectionState: selectionState,
      binding: binding ? JSON.parse(JSON.stringify(binding)) : null,
      bindingConditions: bindingConditions,
      bindingMode: bindingMode,
      textGear: textGear ? {
        controllerName: textGear.controllerName || '',
        defaultValue: textGear.defaultValue || '',
        states: Array.isArray(textGear.states)
          ? textGear.states.map(function (state) {
            return {
              page: state && state.page ? state.page : '',
              value: state && typeof state.value === 'string' ? state.value : '',
            };
          })
          : [],
      } : null,
      colorGear: colorGear ? {
        controllerName: colorGear.controllerName || '',
        defaultColor: serializeColorValue(colorGear.defaultColor || null),
        states: Array.isArray(colorGear.states)
          ? colorGear.states.map(function (state) {
            return {
              page: state && state.page ? state.page : '',
              color: serializeColorValue(state && state.color ? state.color : null),
            };
          })
          : [],
      } : null,
      sizeGear: sizeGear ? {
        controllerName: sizeGear.controllerName || '',
        defaultSize: serializeSizeValue({
          width: sizeGear.defaultWidth,
          height: sizeGear.defaultHeight,
          scaleX: sizeGear.defaultScaleX,
          scaleY: sizeGear.defaultScaleY,
        }),
        states: Array.isArray(sizeGear.states)
          ? sizeGear.states.map(function (state) {
            return {
              page: state && state.page ? state.page : '',
              width: state && typeof state.width === 'number' ? state.width : 0,
              height: state && typeof state.height === 'number' ? state.height : 0,
              scaleX: state && typeof state.scaleX === 'number' ? state.scaleX : 1,
              scaleY: state && typeof state.scaleY === 'number' ? state.scaleY : 1,
            };
          })
          : [],
      } : null,
      fontSizeGear: fontSizeGear ? {
        controllerName: fontSizeGear.controllerName || '',
        defaultValue: typeof fontSizeGear.defaultValue === 'number' ? fontSizeGear.defaultValue : 0,
        states: Array.isArray(fontSizeGear.states)
          ? fontSizeGear.states.map(function (state) {
            return {
              page: state && state.page ? state.page : '',
              value: state && typeof state.value === 'number' ? state.value : 0,
            };
          })
          : [],
      } : null,
      imageGear: imageGear ? {
        controllerName: imageGear.controllerName || '',
        defaultSpriteFrame: imageGear.defaultSpriteFrame
          ? (imageGear.defaultSpriteFrame.name || imageGear.defaultSpriteFrame._uuid || '')
          : '',
        states: Array.isArray(imageGear.states)
          ? imageGear.states.map(function (state) {
            return {
              page: state && state.page ? state.page : '',
              spriteFrame: state && state.spriteFrame
                ? (state.spriteFrame.name || state.spriteFrame._uuid || '')
                : '',
            };
          })
          : [],
      } : null,
      pageOptions: pages.map(function (page) {
        return {
          id: page && page.id ? page.id : '',
          name: page && page.name ? page.name : '',
        };
      }),
    });

    root.innerHTML = '';

    var body = document.createElement('div');
    body.style.padding = '8px 0 4px';

    var bodyTitle = document.createElement('div');
    bodyTitle.textContent = '控制器';
    bodyTitle.style.fontSize = '12px';
    bodyTitle.style.fontWeight = 'bold';
    bodyTitle.style.color = '#c9c9c9';
    bodyTitle.style.marginBottom = '8px';
    body.appendChild(bodyTitle);

    var row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.marginBottom = '10px';

    var icon = document.createElement('span');
    icon.textContent = '◉';
    icon.style.color = '#bdbdbd';
    icon.style.fontSize = '14px';
    row.appendChild(icon);

    var controllerSelect = document.createElement('select');
    controllerSelect.style.flex = '1';
    controllerSelect.style.height = '28px';
    controllerSelect.style.background = '#474747';
    controllerSelect.style.color = '#d3d3d3';
    controllerSelect.style.border = '1px solid #5a5a5a';

    var emptyControllerOption = document.createElement('option');
    emptyControllerOption.value = '';
    emptyControllerOption.textContent = '无';
    emptyControllerOption.selected = controllerName === '';
    controllerSelect.appendChild(emptyControllerOption);

    for (var c = 0; c < controllers.length; c++) {
      var controllerOption = document.createElement('option');
      controllerOption.value = controllers[c].name || '';
      controllerOption.textContent = controllers[c].name || '';
      controllerOption.selected = controllerOption.value === controllerName;
      controllerSelect.appendChild(controllerOption);
    }
    controllerSelect.value = controllerName || '';
    if (!controllerName) {
      controllerSelect.selectedIndex = 0;
    }
    row.appendChild(controllerSelect);

    var pageSelect = null;
    if (controllerName) {
      pageSelect = document.createElement('select');
      pageSelect.style.flex = '1';
      pageSelect.style.height = '28px';
      pageSelect.style.background = '#474747';
      pageSelect.style.color = '#d3d3d3';
      pageSelect.style.border = '1px solid #5a5a5a';

      var emptyPageOption = document.createElement('option');
      emptyPageOption.value = '';
      emptyPageOption.textContent = '无';
      emptyPageOption.selected = pageName === '';
      pageSelect.appendChild(emptyPageOption);

      for (var p = 0; p < pages.length; p++) {
        var pageOption = document.createElement('option');
        pageOption.value = getPageOptionValue(pages[p], p);
        pageOption.textContent = getPageOptionLabel(pages[p], p);
        pageOption.selected = pageOption.value === pageName;
        pageSelect.appendChild(pageOption);
      }
      pageSelect.value = pageName || '';
      if (!pageName) {
        pageSelect.selectedIndex = 0;
      }
      row.appendChild(pageSelect);
    }

    body.appendChild(row);

    var secondaryCondition = bindingConditions.length > 1 ? bindingConditions[1] : null;
    var secondaryControllerName = secondaryCondition ? (secondaryCondition.controllerName || '') : '';
    var secondaryController = null;
    for (var sc = 0; sc < controllers.length; sc++) {
      if (controllers[sc] && controllers[sc].name === secondaryControllerName) {
        secondaryController = controllers[sc];
        break;
      }
    }

    var secondaryPages = secondaryController && secondaryController.pages ? secondaryController.pages : [];
    var secondaryPageName = secondaryCondition ? (secondaryCondition.pageName || '') : '';
    var hasSecondaryPage = false;
    for (var sp = 0; sp < secondaryPages.length; sp++) {
      var secondaryOptionValue = getPageOptionValue(secondaryPages[sp], sp);
      if (secondaryOptionValue === secondaryPageName || ((secondaryPages[sp] && secondaryPages[sp].name) || '') === secondaryPageName) {
        hasSecondaryPage = true;
        secondaryPageName = secondaryOptionValue;
        break;
      }
    }
    if (!hasSecondaryPage) {
      secondaryPageName = '';
    }

    function buildDisplayConfigWithPrimary(nextPrimaryCondition, nextSecondaryCondition, nextMode) {
      var nextConditions = [];
      if (nextPrimaryCondition && nextPrimaryCondition.controllerName && nextPrimaryCondition.pageName) {
        nextConditions.push({
          controllerName: nextPrimaryCondition.controllerName || '',
          pageName: nextPrimaryCondition.pageName || '',
        });
      }
      if (nextSecondaryCondition && nextSecondaryCondition.controllerName && nextSecondaryCondition.pageName) {
        nextConditions.push({
          controllerName: nextSecondaryCondition.controllerName || '',
          pageName: nextSecondaryCondition.pageName || '',
        });
      }
      return {
        conditions: nextConditions,
        mode: nextMode === 'and' ? 'and' : 'or',
      };
    }

    if (secondaryCondition) {
      var secondaryRow = document.createElement('div');
      secondaryRow.style.display = 'flex';
      secondaryRow.style.alignItems = 'center';
      secondaryRow.style.gap = '8px';
      secondaryRow.style.marginBottom = '10px';

      var modeButton = document.createElement('button');
      modeButton.type = 'button';
      modeButton.textContent = bindingMode === 'and' ? '与' : '或';
      modeButton.style.flex = '0 0 40px';
      modeButton.style.height = '28px';
      modeButton.style.background = '#474747';
      modeButton.style.color = '#d3d3d3';
      modeButton.style.border = '1px solid #5a5a5a';
      modeButton.style.cursor = 'pointer';
      secondaryRow.appendChild(modeButton);

      var secondaryControllerSelect = document.createElement('select');
      secondaryControllerSelect.style.flex = '1';
      secondaryControllerSelect.style.height = '28px';
      secondaryControllerSelect.style.background = '#474747';
      secondaryControllerSelect.style.color = '#d3d3d3';
      secondaryControllerSelect.style.border = '1px solid #5a5a5a';

      for (var sc2 = 0; sc2 < controllers.length; sc2++) {
        var secondaryControllerOption = document.createElement('option');
        secondaryControllerOption.value = controllers[sc2].name || '';
        secondaryControllerOption.textContent = controllers[sc2].name || '';
        secondaryControllerSelect.appendChild(secondaryControllerOption);
      }
      secondaryControllerSelect.value = secondaryControllerName || '';
      secondaryRow.appendChild(secondaryControllerSelect);

      var secondaryPageSelect = document.createElement('select');
      secondaryPageSelect.style.flex = '1';
      secondaryPageSelect.style.height = '28px';
      secondaryPageSelect.style.background = '#474747';
      secondaryPageSelect.style.color = '#d3d3d3';
      secondaryPageSelect.style.border = '1px solid #5a5a5a';

      for (var sp2 = 0; sp2 < secondaryPages.length; sp2++) {
        var secondaryPageOption = document.createElement('option');
        secondaryPageOption.value = getPageOptionValue(secondaryPages[sp2], sp2);
        secondaryPageOption.textContent = getPageOptionLabel(secondaryPages[sp2], sp2);
        secondaryPageSelect.appendChild(secondaryPageOption);
      }
      secondaryPageSelect.value = secondaryPageName || '';
      secondaryRow.appendChild(secondaryPageSelect);

      var removeSecondaryButton = createActionButton('X');
      removeSecondaryButton.style.flex = '0 0 auto';
      secondaryRow.appendChild(removeSecondaryButton);

      modeButton.addEventListener('click', function () {
        applyDisplayBindingConfig(buildDisplayConfigWithPrimary(
          { controllerName: controllerSelect.value || '', pageName: pageSelect ? (pageSelect.value || '') : '' },
          { controllerName: secondaryControllerSelect.value || '', pageName: secondaryPageSelect.value || '' },
          bindingMode === 'and' ? 'or' : 'and'
        ));
        renderPropertyControl();
      });

      function handleSecondaryControllerChange() {
        var nextControllerName = secondaryControllerSelect.value || '';
        var nextController = null;
        for (var i = 0; i < controllers.length; i++) {
          if (controllers[i] && controllers[i].name === nextControllerName) {
            nextController = controllers[i];
            break;
          }
        }

        var nextPageName = '';
        if (nextController && nextController.pages && nextController.pages.length) {
          nextPageName = getPageOptionValue(nextController.pages[0], 0);
        }

        applyDisplayBindingConfig(buildDisplayConfigWithPrimary(
          { controllerName: controllerSelect.value || '', pageName: pageSelect ? (pageSelect.value || '') : '' },
          { controllerName: nextControllerName, pageName: nextPageName },
          bindingMode
        ));
        renderPropertyControl();
      }

      function handleSecondaryPageChange() {
        applyDisplayBindingConfig(buildDisplayConfigWithPrimary(
          { controllerName: controllerSelect.value || '', pageName: pageSelect ? (pageSelect.value || '') : '' },
          { controllerName: secondaryControllerSelect.value || '', pageName: secondaryPageSelect.value || '' },
          bindingMode
        ));
        renderPropertyControl();
      }

      removeSecondaryButton.addEventListener('click', function () {
        applyDisplayBindingConfig(buildDisplayConfigWithPrimary(
          { controllerName: controllerSelect.value || '', pageName: pageSelect ? (pageSelect.value || '') : '' },
          null,
          bindingMode
        ));
        renderPropertyControl();
      });

      secondaryControllerSelect.addEventListener('change', handleSecondaryControllerChange);
      secondaryControllerSelect.addEventListener('input', handleSecondaryControllerChange);
      secondaryPageSelect.addEventListener('change', handleSecondaryPageChange);
      secondaryPageSelect.addEventListener('input', handleSecondaryPageChange);

      body.appendChild(secondaryRow);
    }

    var actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.alignItems = 'center';
    actions.style.gap = '16px';

    function createActionButton(text) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.style.background = 'transparent';
      button.style.color = '#d3d3d3';
      button.style.border = '0';
      button.style.padding = '0';
      button.style.cursor = 'pointer';
      button.style.fontSize = '12px';
      return button;
    }

    var addButton = createActionButton('+ 更多控制');
    addButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      showMoreControlMenu(addButton);
    });
    actions.appendChild(addButton);

    var copyButton = createActionButton('复制');
    copyButton.addEventListener('click', function () {
      var currentBinding = getDisplayBinding(getRootControllerComponent(false), rootNode, getSelectedNode());
      if (!currentBinding) {
        return;
      }
      window.__fairyControllerPropertyClipboard = {
        conditions: getDisplayBindingConditions(currentBinding),
        mode: getDisplayBindingMode(currentBinding),
      };
    });
    actions.appendChild(copyButton);

    var pasteButton = createActionButton('粘贴');
    pasteButton.addEventListener('click', function () {
      var clipboard = window.__fairyControllerPropertyClipboard || null;
      if (!clipboard) {
        return;
      }
      applyDisplayBindingConfig({
        conditions: Array.isArray(clipboard.conditions) ? clipboard.conditions : [],
        mode: clipboard.mode === 'and' ? 'and' : 'or',
      });
      renderPropertyControl();
    });
    actions.appendChild(pasteButton);

    if (textGear) {
      var textBlock = document.createElement('div');
      textBlock.style.marginTop = '12px';

      var textRow = document.createElement('div');
      textRow.style.display = 'flex';
      textRow.style.alignItems = 'center';
      textRow.style.gap = '8px';
      textRow.style.marginBottom = '8px';

      var textIcon = document.createElement('span');
      textIcon.textContent = '文本';
      textIcon.style.color = '#bdbdbd';
      textIcon.style.fontSize = '14px';
      textRow.appendChild(textIcon);

      var textControllerSelect = document.createElement('select');
      textControllerSelect.style.flex = '1';
      textControllerSelect.style.height = '28px';
      textControllerSelect.style.background = '#474747';
      textControllerSelect.style.color = '#d3d3d3';
      textControllerSelect.style.border = '1px solid #5a5a5a';

      var textEmptyControllerOption = document.createElement('option');
      textEmptyControllerOption.value = '';
      textEmptyControllerOption.textContent = '无';
      textControllerSelect.appendChild(textEmptyControllerOption);

      for (var c2 = 0; c2 < controllers.length; c2++) {
        var textControllerOption = document.createElement('option');
        textControllerOption.value = controllers[c2].name || '';
        textControllerOption.textContent = controllers[c2].name || '';
        textControllerSelect.appendChild(textControllerOption);
      }
      textControllerSelect.value = textControllerName || '';
      textRow.appendChild(textControllerSelect);

      var removeTextButton = createActionButton('X');
      removeTextButton.style.flex = '0 0 auto';
      removeTextButton.addEventListener('click', function () {
        if (removeTextGear(selectedNode)) {
          setTextSelectionState(selectedNode, '', '');
          renderPropertyControl();
        }
      });
      textRow.appendChild(removeTextButton);

      textBlock.appendChild(textRow);

      function handleTextControllerChange() {
        saveTextForSelection(selectedNode, getEffectiveTextSelectionState(selectedNode, textGear));
        var nextControllerName = textControllerSelect.value || '';
        var nextController = null;
        for (var i = 0; i < controllers.length; i++) {
          if (controllers[i] && controllers[i].name === nextControllerName) {
            nextController = controllers[i];
            break;
          }
        }

        var nextPageName = '';
        if (nextController && nextController.pages && nextController.pages.length) {
          nextPageName = getResolvedTextPageName(nextControllerName, getPageOptionValue(nextController.pages[0], 0));
        }
        initializeTextGearStates(selectedNode, nextControllerName);
        setTextSelectionState(selectedNode, nextControllerName, nextPageName);
        applyTextPropertyGear(nextControllerName, nextPageName);
        renderPropertyControl();
      }

      textControllerSelect.addEventListener('change', handleTextControllerChange);
      textControllerSelect.addEventListener('input', handleTextControllerChange);

      body.appendChild(textBlock);
    }

    if (colorGear) {
      var colorBlock = document.createElement('div');
      colorBlock.style.marginTop = '12px';

      var colorRow = document.createElement('div');
      colorRow.style.display = 'flex';
      colorRow.style.alignItems = 'center';
      colorRow.style.gap = '8px';
      colorRow.style.marginBottom = '8px';

      var colorIcon = document.createElement('span');
      colorIcon.textContent = '颜色';
      colorIcon.style.color = '#bdbdbd';
      colorIcon.style.fontSize = '14px';
      colorRow.appendChild(colorIcon);

      var colorControllerSelect = document.createElement('select');
      colorControllerSelect.style.flex = '1';
      colorControllerSelect.style.height = '28px';
      colorControllerSelect.style.background = '#474747';
      colorControllerSelect.style.color = '#d3d3d3';
      colorControllerSelect.style.border = '1px solid #5a5a5a';

      var colorEmptyControllerOption = document.createElement('option');
      colorEmptyControllerOption.value = '';
      colorEmptyControllerOption.textContent = '无';
      colorControllerSelect.appendChild(colorEmptyControllerOption);

      for (var c3 = 0; c3 < controllers.length; c3++) {
        var colorControllerOption = document.createElement('option');
        colorControllerOption.value = controllers[c3].name || '';
        colorControllerOption.textContent = controllers[c3].name || '';
        colorControllerSelect.appendChild(colorControllerOption);
      }
      colorControllerSelect.value = colorControllerName || '';
      colorRow.appendChild(colorControllerSelect);

      var removeColorButton = createActionButton('X');
      removeColorButton.style.flex = '0 0 auto';
      removeColorButton.addEventListener('click', function () {
        if (removeColorGear(selectedNode)) {
          setColorSelectionState(selectedNode, '', '');
          renderPropertyControl();
        }
      });
      colorRow.appendChild(removeColorButton);

      colorBlock.appendChild(colorRow);

      function handleColorControllerChange() {
        saveColorForSelection(selectedNode, getEffectiveColorSelectionState(selectedNode, colorGear));
        var nextControllerName = colorControllerSelect.value || '';
        var nextController = null;
        for (var i = 0; i < controllers.length; i++) {
          if (controllers[i] && controllers[i].name === nextControllerName) {
            nextController = controllers[i];
            break;
          }
        }

        var nextPageName = '';
        if (nextController && nextController.pages && nextController.pages.length) {
          nextPageName = getResolvedTextPageName(nextControllerName, getPageOptionValue(nextController.pages[0], 0));
        }
        initializeColorGearStates(selectedNode, nextControllerName);
        setColorSelectionState(selectedNode, nextControllerName, nextPageName);
        applyColorPropertyGear(nextControllerName, nextPageName);
        renderPropertyControl();
      }

      colorControllerSelect.addEventListener('change', handleColorControllerChange);
      colorControllerSelect.addEventListener('input', handleColorControllerChange);

      body.appendChild(colorBlock);
    }

    if (sizeGear) {
      var sizeBlock = document.createElement('div');
      sizeBlock.style.marginTop = '12px';

      var sizeRow = document.createElement('div');
      sizeRow.style.display = 'flex';
      sizeRow.style.alignItems = 'center';
      sizeRow.style.gap = '8px';
      sizeRow.style.marginBottom = '8px';

      var sizeIcon = document.createElement('span');
      sizeIcon.textContent = '大小';
      sizeIcon.style.color = '#bdbdbd';
      sizeIcon.style.fontSize = '14px';
      sizeRow.appendChild(sizeIcon);

      var sizeControllerSelect = document.createElement('select');
      sizeControllerSelect.style.flex = '1';
      sizeControllerSelect.style.height = '28px';
      sizeControllerSelect.style.background = '#474747';
      sizeControllerSelect.style.color = '#d3d3d3';
      sizeControllerSelect.style.border = '1px solid #5a5a5a';

      var sizeEmptyControllerOption = document.createElement('option');
      sizeEmptyControllerOption.value = '';
      sizeEmptyControllerOption.textContent = '无';
      sizeControllerSelect.appendChild(sizeEmptyControllerOption);

      for (var c4 = 0; c4 < controllers.length; c4++) {
        var sizeControllerOption = document.createElement('option');
        sizeControllerOption.value = controllers[c4].name || '';
        sizeControllerOption.textContent = controllers[c4].name || '';
        sizeControllerSelect.appendChild(sizeControllerOption);
      }
      sizeControllerSelect.value = sizeControllerName || '';
      sizeRow.appendChild(sizeControllerSelect);

      var removeSizeButton = createActionButton('X');
      removeSizeButton.style.flex = '0 0 auto';
      removeSizeButton.addEventListener('click', function () {
        if (removeSizeGear(selectedNode)) {
          setSizeSelectionState(selectedNode, '', '');
          renderPropertyControl();
        }
      });
      sizeRow.appendChild(removeSizeButton);

      sizeBlock.appendChild(sizeRow);

      function handleSizeControllerChange() {
        saveSizeForSelection(selectedNode, getEffectiveSizeSelectionState(selectedNode, sizeGear));
        var nextControllerName = sizeControllerSelect.value || '';
        var nextController = null;
        for (var i = 0; i < controllers.length; i++) {
          if (controllers[i] && controllers[i].name === nextControllerName) {
            nextController = controllers[i];
            break;
          }
        }

        var nextPageName = '';
        if (nextController && nextController.pages && nextController.pages.length) {
          nextPageName = getResolvedTextPageName(nextControllerName, getPageOptionValue(nextController.pages[0], 0));
        }
        initializeSizeGearStates(selectedNode, nextControllerName);
        setSizeSelectionState(selectedNode, nextControllerName, nextPageName);
        applySizePropertyGear(nextControllerName, nextPageName);
        renderPropertyControl();
      }

      sizeControllerSelect.addEventListener('change', handleSizeControllerChange);
      sizeControllerSelect.addEventListener('input', handleSizeControllerChange);

      body.appendChild(sizeBlock);
    }

    if (fontSizeGear) {
      var fontSizeBlock = document.createElement('div');
      fontSizeBlock.style.marginTop = '12px';

      var fontSizeRow = document.createElement('div');
      fontSizeRow.style.display = 'flex';
      fontSizeRow.style.alignItems = 'center';
      fontSizeRow.style.gap = '8px';
      fontSizeRow.style.marginBottom = '8px';

      var fontSizeIcon = document.createElement('span');
      fontSizeIcon.textContent = '字号';
      fontSizeIcon.style.color = '#bdbdbd';
      fontSizeIcon.style.fontSize = '14px';
      fontSizeRow.appendChild(fontSizeIcon);

      var fontSizeControllerSelect = document.createElement('select');
      fontSizeControllerSelect.style.flex = '1';
      fontSizeControllerSelect.style.height = '28px';
      fontSizeControllerSelect.style.background = '#474747';
      fontSizeControllerSelect.style.color = '#d3d3d3';
      fontSizeControllerSelect.style.border = '1px solid #5a5a5a';

      var fontSizeEmptyControllerOption = document.createElement('option');
      fontSizeEmptyControllerOption.value = '';
      fontSizeEmptyControllerOption.textContent = '无';
      fontSizeControllerSelect.appendChild(fontSizeEmptyControllerOption);

      for (var c5 = 0; c5 < controllers.length; c5++) {
        var fontSizeControllerOption = document.createElement('option');
        fontSizeControllerOption.value = controllers[c5].name || '';
        fontSizeControllerOption.textContent = controllers[c5].name || '';
        fontSizeControllerSelect.appendChild(fontSizeControllerOption);
      }
      fontSizeControllerSelect.value = fontSizeControllerName || '';
      fontSizeRow.appendChild(fontSizeControllerSelect);

      var removeFontSizeButton = createActionButton('X');
      removeFontSizeButton.style.flex = '0 0 auto';
      removeFontSizeButton.addEventListener('click', function () {
        if (removeFontSizeGear(selectedNode)) {
          setFontSizeSelectionState(selectedNode, '', '');
          renderPropertyControl();
        }
      });
      fontSizeRow.appendChild(removeFontSizeButton);

      fontSizeBlock.appendChild(fontSizeRow);

      function handleFontSizeControllerChange() {
        saveFontSizeForSelection(selectedNode, getEffectiveFontSizeSelectionState(selectedNode, fontSizeGear));
        var nextControllerName = fontSizeControllerSelect.value || '';
        var nextController = null;
        for (var i = 0; i < controllers.length; i++) {
          if (controllers[i] && controllers[i].name === nextControllerName) {
            nextController = controllers[i];
            break;
          }
        }

        var nextPageName = '';
        if (nextController && nextController.pages && nextController.pages.length) {
          nextPageName = getResolvedTextPageName(nextControllerName, getPageOptionValue(nextController.pages[0], 0));
        }
        initializeFontSizeGearStates(selectedNode, nextControllerName);
        setFontSizeSelectionState(selectedNode, nextControllerName, nextPageName);
        applyFontSizePropertyGear(nextControllerName, nextPageName);
        renderPropertyControl();
      }

      fontSizeControllerSelect.addEventListener('change', handleFontSizeControllerChange);
      fontSizeControllerSelect.addEventListener('input', handleFontSizeControllerChange);

      body.appendChild(fontSizeBlock);
    }

    if (imageGear) {
      var imageBlock = document.createElement('div');
      imageBlock.style.marginTop = '12px';

      var imageRow = document.createElement('div');
      imageRow.style.display = 'flex';
      imageRow.style.alignItems = 'center';
      imageRow.style.gap = '8px';
      imageRow.style.marginBottom = '8px';

      var imageIcon = document.createElement('span');
      imageIcon.textContent = '图片';
      imageIcon.style.color = '#bdbdbd';
      imageIcon.style.fontSize = '14px';
      imageRow.appendChild(imageIcon);

      var imageControllerSelect = document.createElement('select');
      imageControllerSelect.style.flex = '1';
      imageControllerSelect.style.height = '28px';
      imageControllerSelect.style.background = '#474747';
      imageControllerSelect.style.color = '#d3d3d3';
      imageControllerSelect.style.border = '1px solid #5a5a5a';

      var imageEmptyControllerOption = document.createElement('option');
      imageEmptyControllerOption.value = '';
      imageEmptyControllerOption.textContent = '无';
      imageControllerSelect.appendChild(imageEmptyControllerOption);

      for (var c6 = 0; c6 < controllers.length; c6++) {
        var imageControllerOption = document.createElement('option');
        imageControllerOption.value = controllers[c6].name || '';
        imageControllerOption.textContent = controllers[c6].name || '';
        imageControllerSelect.appendChild(imageControllerOption);
      }
      imageControllerSelect.value = imageControllerName || '';
      imageRow.appendChild(imageControllerSelect);

      var removeImageButton = createActionButton('X');
      removeImageButton.style.flex = '0 0 auto';
      removeImageButton.addEventListener('click', function () {
        if (removeImageGear(selectedNode)) {
          setImageSelectionState(selectedNode, '', '');
          renderPropertyControl();
        }
      });
      imageRow.appendChild(removeImageButton);

      imageBlock.appendChild(imageRow);

      function handleImageControllerChange() {
        saveImageForSelection(selectedNode, getEffectiveImageSelectionState(selectedNode, imageGear));
        var nextControllerName = imageControllerSelect.value || '';
        var nextController = null;
        for (var i = 0; i < controllers.length; i++) {
          if (controllers[i] && controllers[i].name === nextControllerName) {
            nextController = controllers[i];
            break;
          }
        }

        var nextPageName = '';
        if (nextController && nextController.pages && nextController.pages.length) {
          nextPageName = getResolvedTextPageName(nextControllerName, getPageOptionValue(nextController.pages[0], 0));
        }
        initializeImageGearStates(selectedNode, nextControllerName);
        setImageSelectionState(selectedNode, nextControllerName, nextPageName);
        applyImagePropertyGear(nextControllerName, nextPageName);
        renderPropertyControl();
      }

      imageControllerSelect.addEventListener('change', handleImageControllerChange);
      imageControllerSelect.addEventListener('input', handleImageControllerChange);

      body.appendChild(imageBlock);
    }

    actions.style.marginTop = '10px';
    body.appendChild(actions);

    function handleControllerSelectChange() {
      var nextControllerName = controllerSelect.value || '';
      var nextController = null;
      for (var i = 0; i < controllers.length; i++) {
        if (controllers[i] && controllers[i].name === nextControllerName) {
          nextController = controllers[i];
          break;
        }
      }

      var nextPageName = '';
      if (nextController && nextController.pages && nextController.pages.length) {
        nextPageName = getPageOptionValue(nextController.pages[0], 0);
      }

      logPropertyControl('controller-change', {
        nodeName: selectedNode ? (selectedNode.name || '') : '',
        nextControllerName: nextControllerName,
        nextPageName: nextPageName,
      });

      applyDisplayBindingConfig(buildDisplayConfigWithPrimary(
        { controllerName: nextControllerName, pageName: nextPageName },
        secondaryCondition ? {
          controllerName: secondaryControllerName || '',
          pageName: secondaryPageName || '',
        } : null,
        bindingMode
      ));
      renderPropertyControl();
    }

    controllerSelect.addEventListener('change', handleControllerSelectChange);
    controllerSelect.addEventListener('input', handleControllerSelectChange);

    if (pageSelect) {
      function handlePageSelectChange() {
        logPropertyControl('page-change', {
          nodeName: selectedNode ? (selectedNode.name || '') : '',
          controllerName: controllerSelect.value || '',
          pageName: pageSelect.value || '',
        });
        applyDisplayBindingConfig(buildDisplayConfigWithPrimary(
          { controllerName: controllerSelect.value || '', pageName: pageSelect.value || '' },
          secondaryCondition ? {
            controllerName: secondaryControllerName || '',
            pageName: secondaryPageName || '',
          } : null,
          bindingMode
        ));
      }

      pageSelect.addEventListener('change', handlePageSelectChange);
      pageSelect.addEventListener('input', handlePageSelectChange);
    }

    logPropertyControl('render-dom-value', {
      nodeName: selectedNode ? (selectedNode.name || '') : '',
      controllerValue: controllerSelect ? (controllerSelect.value || '') : '',
      pageValue: pageSelect ? (pageSelect.value || '') : '',
      pageSelectedIndex: pageSelect ? pageSelect.selectedIndex : -1,
    });

    root.appendChild(body);
    root.style.display = 'block';
    return true;
  }

  function ensurePropertyControl() {
    try {
      renderPropertyControl();
    }
    catch (error) {
      console.warn('[fairy-controller-editor] render property control failed:', error);
    }
  }

  window.__fairyControllerToolbarApi = {
    update: function (state) {
      window.__fairyControllerToolbarState = state || {
        controllers: [],
        currentController: '',
        context: null,
      };
      createToolbar();
      ensurePropertyControl();
    }
  };

  function ensureToolbar() {
    try {
      ensureDebugMarker();
      createToolbar();
      ensurePropertyControl();
    }
    catch (error) {
      console.warn('[fairy-controller-editor] inject toolbar failed:', error);
    }
  }

  ensureToolbar();
  window.__fairyControllerLastStorageSignature = getStorageSignature();
  window.__fairyControllerLastPropertySignature = getPropertyControlSignature();

  window.addEventListener('focus', ensureToolbar);

  if (!window.__fairyControllerRefreshTimer) {
    window.__fairyControllerRefreshTimer = setInterval(function () {
      var nextSignature = getStorageSignature();
      var nextPropertySignature = getPropertyControlSignature();
      if (nextSignature !== window.__fairyControllerLastStorageSignature) {
        window.__fairyControllerLastStorageSignature = nextSignature;
        ensureToolbar();
      }
      if (nextPropertySignature !== window.__fairyControllerLastPropertySignature) {
        logPropertyControl('refresh-signature-changed', {
          previous: window.__fairyControllerLastPropertySignature,
          next: nextPropertySignature,
        });
        window.__fairyControllerLastPropertySignature = nextPropertySignature;
        ensurePropertyControl();
      }
    }, 1000);
  }
})();
`;

let injectTimer = null;
let toolbarState = {
  controllers: [],
  currentController: '',
  currentPage: '',
  context: null,
};
global.__fairyControllerPanelPayload = null;

function moveEditorPanelUp() {
  try {
    const windows = electron.BrowserWindow.getAllWindows();
    if (!windows || !windows.length) {
      return;
    }

    for (let i = windows.length - 1; i >= 0; i--) {
      const win = windows[i];
      if (!win || win.isDestroyed()) {
        continue;
      }

      const title = typeof win.getTitle === 'function' ? (win.getTitle() || '') : '';
      if (title !== 'Fairy Controller') {
        continue;
      }

      const bounds = typeof win.getBounds === 'function' ? win.getBounds() : null;
      if (!bounds) {
        return;
      }

      const nextY = Math.max(40, bounds.y - PANEL_VERTICAL_OFFSET);
      if (typeof win.setBounds === 'function') {
        win.setBounds({
          x: bounds.x,
          y: nextY,
          width: bounds.width,
          height: bounds.height,
        });
      }
      else if (typeof win.setPosition === 'function') {
        win.setPosition(bounds.x, nextY);
      }
      return;
    }
  }
  catch (error) {
    Editor.warn('[fairy-controller-editor] move panel up failed: ' + error.message);
  }
}

function injectToolbar() {
  const windows = electron.BrowserWindow.getAllWindows();
  if (!windows || !windows.length) {
    return;
  }

  windows.forEach((win) => {
    if (!win || win.isDestroyed()) {
      return;
    }

    win.webContents.executeJavaScript(INJECT_SCRIPT).catch((error) => {
      Editor.warn('[fairy-controller-editor] execute inject script failed: ' + error.message);
    });
  });
}

function syncToolbarState(state) {
  toolbarState = Object.assign({
    controllers: [],
    currentController: '',
    currentPage: '',
    context: toolbarState && toolbarState.context ? toolbarState.context : null,
  }, state || {});

  const windows = electron.BrowserWindow.getAllWindows();
  if (!windows || !windows.length) {
    return;
  }

  const serializedState = JSON.stringify(toolbarState);
  const script = `
    if (window.__fairyControllerToolbarApi) {
      window.__fairyControllerToolbarApi.update(${serializedState});
    } else {
      window.__fairyControllerToolbarState = ${serializedState};
    }
  `;

  windows.forEach((win) => {
    if (!win || win.isDestroyed()) {
      return;
    }

    win.webContents.executeJavaScript(script).catch((error) => {
      Editor.warn('[fairy-controller-editor] sync toolbar state failed: ' + error.message);
    });
  });
}

function mirrorDebugLog(step, payload) {
  const windows = electron.BrowserWindow.getAllWindows();
  if (!windows || !windows.length) {
    return;
  }

  let serialized = '{}';
  try {
    serialized = JSON.stringify(payload || {});
  }
  catch (error) {
    serialized = JSON.stringify({
      error: error.message,
    });
  }

  const script = `
    console.log('[fairy-controller-editor][persist][${step}] ' + ${JSON.stringify(serialized)});
  `;

  windows.forEach((win) => {
    if (!win || win.isDestroyed()) {
      return;
    }

    win.webContents.executeJavaScript(script).catch(() => { });
  });
}

function requestSceneSave() {
  try {
    Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save');
  }
  catch (error) {
    try {
      Editor.Ipc.sendToPanel('scene', 'scene:save');
    }
    catch (saveError) {
      Editor.warn('[fairy-controller-editor] request scene save failed: ' + (saveError.message || error.message));
    }
  }
}

function querySelectionPersistenceInfo() {
  const windows = electron.BrowserWindow.getAllWindows();
  if (!windows || !windows.length) {
    return Promise.resolve(null);
  }

  const script = `
    (function () {
      if (!window.cc || !cc.director) {
        return null;
      }

      function getStorageScene() {
        return cc.director.getScene && cc.director.getScene();
      }

      function getSelectedNode() {
        if (!window.Editor || !Editor.Selection || !Editor.Selection.curActivate) {
          return null;
        }

        var scene = getStorageScene();
        var uuid = Editor.Selection.curActivate('node') || '';
        if (!scene || !uuid) {
          return null;
        }

        if (scene.uuid === uuid) {
          return scene;
        }

        if (scene.getChildByUuid) {
          var directMatch = scene.getChildByUuid(uuid);
          if (directMatch) {
            return directMatch;
          }
        }

        var stack = scene.children ? scene.children.slice() : [];
        while (stack.length) {
          var current = stack.shift();
          if (!current || !cc.isValid(current, true)) {
            continue;
          }
          if (current.uuid === uuid) {
            return current;
          }
          if (current.children && current.children.length) {
            for (var i = 0; i < current.children.length; i++) {
              stack.push(current.children[i]);
            }
          }
        }

        return null;
      }

      function getRootEditingNode() {
        var scene = getStorageScene();
        var selectedNode = getSelectedNode();
        if (!scene || !selectedNode) {
          return null;
        }

        var current = selectedNode;
        while (current && current.parent && current.parent !== scene) {
          current = current.parent;
        }

        return current || null;
      }

      function getStorageNode() {
        var scene = getStorageScene();
        if (!scene) {
          return null;
        }

        var rootEditingNode = getRootEditingNode();
        if (rootEditingNode && cc.isValid(rootEditingNode, true)) {
          return rootEditingNode;
        }

        var children = scene.children || [];
        for (var i = 0; i < children.length; i++) {
          if (children[i] && cc.isValid(children[i], true)) {
            return children[i];
          }
        }

        return scene;
      }

      var scene = getStorageScene();
      var node = getStorageNode();
      var prefabInfo = node && node._prefab ? node._prefab : null;
      var prefabAsset = prefabInfo && prefabInfo.asset ? prefabInfo.asset : null;

      return {
        sceneUuid: scene ? (scene.uuid || scene._id || '') : '',
        rootNodeUuid: node ? (node.uuid || node._id || '') : '',
        rootNodeName: node ? (node.name || '') : '',
        prefabAssetUuid: prefabAsset ? (prefabAsset._uuid || prefabAsset.uuid || '') : '',
        prefabAssetUrl: prefabAsset ? (prefabAsset.nativeUrl || prefabAsset.url || '') : '',
      };
    })();
  `;

  const tasks = windows.map((win) => {
    if (!win || win.isDestroyed()) {
      return Promise.resolve(null);
    }
    return win.webContents.executeJavaScript(script).catch(() => null);
  });

  return Promise.all(tasks).then((results) => {
    for (let i = 0; i < results.length; i++) {
      if (results[i] && (results[i].sceneUuid || results[i].prefabAssetUuid || results[i].prefabAssetUrl)) {
        return results[i];
      }
    }
    return null;
  });
}

function walkFiles(dir, matcher, result) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, matcher, result);
      return;
    }

    if (matcher(fullPath)) {
      result.push(fullPath);
    }
  });
}

function resolveAssetPathByUuid(uuid, expectedExt) {
  if (!uuid) {
    return '';
  }

  try {
    if (Editor.assetdb && Editor.assetdb.uuidToFspath) {
      const fsPath = Editor.assetdb.uuidToFspath(uuid);
      if (fsPath && (!expectedExt || fsPath.endsWith(expectedExt))) {
        return fsPath;
      }
    }
  }
  catch (error) { }

  const assetsDir = path.join(Editor.Project.path, 'assets');
  const metaFiles = [];
  walkFiles(assetsDir, (filePath) => filePath.endsWith('.meta'), metaFiles);

  for (let i = 0; i < metaFiles.length; i++) {
    const metaPath = metaFiles[i];
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (meta && meta.uuid === uuid) {
        const assetPath = metaPath.slice(0, -5);
        if (!expectedExt || assetPath.endsWith(expectedExt)) {
          return assetPath;
        }
      }
    }
    catch (error) { }
  }

  return '';
}

function findSceneAssetPathBySceneUuid(sceneUuid) {
  if (!sceneUuid) {
    return '';
  }

  const assetsDir = path.join(Editor.Project.path, 'assets');
  const sceneFiles = [];
  walkFiles(assetsDir, (filePath) => filePath.endsWith('.fire'), sceneFiles);

  for (let i = 0; i < sceneFiles.length; i++) {
    const scenePath = sceneFiles[i];
    try {
      const content = fs.readFileSync(scenePath, 'utf8');
      if (content.indexOf(sceneUuid) !== -1) {
        return scenePath;
      }
    }
    catch (error) { }
  }

  return '';
}

function resolveEditingAssetPath(info) {
  if (!info) {
    return '';
  }

  if (info.prefabAssetUrl) {
    if (path.isAbsolute(info.prefabAssetUrl) && fs.existsSync(info.prefabAssetUrl)) {
      return info.prefabAssetUrl;
    }
    if (info.prefabAssetUrl.indexOf('db://') === 0 && Editor.assetdb && Editor.assetdb.urlToFspath) {
      try {
        return Editor.assetdb.urlToFspath(info.prefabAssetUrl);
      }
      catch (error) { }
    }
  }

  if (info.prefabAssetUuid) {
    const prefabPath = resolveAssetPathByUuid(info.prefabAssetUuid, '.prefab');
    if (prefabPath) {
      return prefabPath;
    }
  }

  let scenePath = findSceneAssetPathBySceneUuid(info.sceneUuid || '');
  if (scenePath) {
    return scenePath;
  }

  const assetsDir = path.join(Editor.Project.path, 'assets');
  const sceneFiles = [];
  walkFiles(assetsDir, (filePath) => filePath.endsWith('.fire'), sceneFiles);
  if (sceneFiles.length === 1) {
    return sceneFiles[0];
  }

  return '';
}

function ensureFileControllerData(assetPath, info, updater) {
  if (!assetPath || !fs.existsSync(assetPath)) {
    Editor.log('[fairy-controller-editor] ensureFileControllerData skipped: missing asset path', assetPath || '', info || null);
    return false;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(assetPath, 'utf8'));
  }
  catch (error) {
    Editor.warn('[fairy-controller-editor] parse asset file failed: ' + error.message);
    return false;
  }

  if (!Array.isArray(data) || !data.length) {
    Editor.log('[fairy-controller-editor] ensureFileControllerData skipped: invalid asset json', assetPath, info || null);
    return false;
  }

  let nodeIndex = -1;
  if (assetPath.endsWith('.prefab')) {
    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      if (entry && entry.__type__ === 'cc.Node' && !entry._parent) {
        nodeIndex = i;
        break;
      }
    }
  }
  else {
    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      if (entry && entry.__type__ === 'cc.Node' && entry._id === info.rootNodeUuid) {
        nodeIndex = i;
        break;
      }
    }
  }

  if (nodeIndex < 0) {
    if (!assetPath.endsWith('.prefab')) {
      for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        if (entry && entry.__type__ === 'cc.Node' && entry._parent && entry._parent.__id__ === 1) {
          nodeIndex = i;
          break;
        }
      }
    }
  }

  if (nodeIndex < 0) {
    Editor.log('[fairy-controller-editor] ensureFileControllerData skipped: root node not found', assetPath, info || null);
    return false;
  }

  const node = data[nodeIndex];
  node._components = Array.isArray(node._components) ? node._components : [];

  const supportedTypes = {};
  supportedTypes[UI_CONTROLLER_SCRIPT_UUID] = true;
  supportedTypes[UI_CONTROLLER_DATA_UUID] = true;
  for (let i = 0; i < LEGACY_UI_CONTROLLER_DATA_UUIDS.length; i++) {
    supportedTypes[LEGACY_UI_CONTROLLER_DATA_UUIDS[i]] = true;
  }

  const componentIndexes = [];
  for (let i = 0; i < node._components.length; i++) {
    const ref = node._components[i];
    const refId = ref && typeof ref.__id__ === 'number' ? ref.__id__ : -1;
    const component = refId >= 0 ? data[refId] : null;
    if (component && supportedTypes[component.__type__]) {
      componentIndexes.push(refId);
    }
  }

  let componentIndex = -1;
  for (let i = 0; i < componentIndexes.length; i++) {
    const currentIndex = componentIndexes[i];
    const component = data[currentIndex];
    if (component && component.__type__ === UI_CONTROLLER_SCRIPT_UUID) {
      componentIndex = currentIndex;
      break;
    }
  }
  if (componentIndex < 0) {
    for (let i = 0; i < componentIndexes.length; i++) {
      const currentIndex = componentIndexes[i];
      const component = data[currentIndex];
      if (component && component.__type__ === UI_CONTROLLER_DATA_UUID) {
        componentIndex = currentIndex;
        break;
      }
    }
  }
  if (componentIndex < 0) {
    for (let i = 0; i < componentIndexes.length; i++) {
      const currentIndex = componentIndexes[i];
      const component = data[currentIndex];
      if (component && LEGACY_UI_CONTROLLER_DATA_UUIDS.indexOf(component.__type__) !== -1) {
        componentIndex = currentIndex;
        break;
      }
    }
  }
  if (componentIndex < 0 && componentIndexes.length) {
    componentIndex = componentIndexes[0];
  }

  if (componentIndex < 0) {
    componentIndex = data.length;
    data.push({
      __type__: UI_CONTROLLER_SCRIPT_UUID,
      _name: '',
      _objFlags: 0,
      node: {
        __id__: nodeIndex,
      },
      _enabled: true,
      controllersJson: '[]',
      bindingsJson: '[]',
      previewController: '',
      previewPage: '',
      _id: '',
    });
    node._components.push({
      __id__: componentIndex,
    });
  }
  else {
    const primaryComponent = data[componentIndex];
    if (primaryComponent) {
      for (let i = 0; i < componentIndexes.length; i++) {
        const duplicateIndex = componentIndexes[i];
        if (duplicateIndex === componentIndex) {
          continue;
        }
        const duplicateComponent = data[duplicateIndex];
        if (!duplicateComponent) {
          continue;
        }
        if ((!primaryComponent.controllersJson || primaryComponent.controllersJson === '[]') && duplicateComponent.controllersJson) {
          primaryComponent.controllersJson = duplicateComponent.controllersJson;
        }
        if ((!primaryComponent.bindingsJson || primaryComponent.bindingsJson === '[]') && duplicateComponent.bindingsJson) {
          primaryComponent.bindingsJson = duplicateComponent.bindingsJson;
        }
        if (!primaryComponent.previewController && duplicateComponent.previewController) {
          primaryComponent.previewController = duplicateComponent.previewController;
        }
        if (!primaryComponent.previewPage && duplicateComponent.previewPage) {
          primaryComponent.previewPage = duplicateComponent.previewPage;
        }
      }
    }
  }

  updater(data[componentIndex]);
  if (info && info.__fairyRenameOriginalName && info.__fairyRenameNextName) {
    renameControllerReferencesInSerializedData(
      data,
      info.__fairyRenameOriginalName,
      info.__fairyRenameNextName
    );
  }

  const duplicateIndexes = componentIndexes.filter((index) => index !== componentIndex);
  if (duplicateIndexes.length) {
    const removeLookup = {};
    for (let i = 0; i < duplicateIndexes.length; i++) {
      removeLookup[duplicateIndexes[i]] = true;
    }

    node._components = node._components.filter((ref) => {
      const refId = ref && typeof ref.__id__ === 'number' ? ref.__id__ : -1;
      return !removeLookup[refId];
    });

    const remap = {};
    const compacted = [];
    for (let i = 0; i < data.length; i++) {
      if (removeLookup[i]) {
        continue;
      }
      remap[i] = compacted.length;
      compacted.push(data[i]);
    }

    function rewriteRefs(target) {
      if (!target || typeof target !== 'object') {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(target, '__id__') && typeof target.__id__ === 'number') {
        target.__id__ = remap[target.__id__];
        return;
      }

      if (Array.isArray(target)) {
        for (let i = 0; i < target.length; i++) {
          rewriteRefs(target[i]);
        }
        return;
      }

      const keys = Object.keys(target);
      for (let i = 0; i < keys.length; i++) {
        rewriteRefs(target[keys[i]]);
      }
    }

    rewriteRefs(compacted);
    data = compacted;
  }

  fs.writeFileSync(assetPath, JSON.stringify(data, null, 2));
  return true;
}

function parseControllersJson(text) {
  try {
    const parsed = JSON.parse(text || '[]');
    return Array.isArray(parsed) ? parsed : [];
  }
  catch (error) {
    return [];
  }
}

function renameBindingControllerReferences(bindingsJson, originalName, nextName) {
  if (!originalName || !nextName || originalName === nextName) {
    return bindingsJson || '[]';
  }

  let bindings;
  try {
    bindings = JSON.parse(bindingsJson || '[]');
  }
  catch (error) {
    return bindingsJson || '[]';
  }

  if (!Array.isArray(bindings)) {
    return bindingsJson || '[]';
  }

  let changed = false;
  bindings.forEach((binding) => {
    if (!binding || binding.type !== 'display') {
      return;
    }

    if (binding.controllerName === originalName) {
      binding.controllerName = nextName;
      changed = true;
    }

    const values = binding.values || null;
    const conditions = values && Array.isArray(values.conditions) ? values.conditions : [];
    conditions.forEach((condition) => {
      if (condition && condition.controllerName === originalName) {
        condition.controllerName = nextName;
        changed = true;
      }
    });
  });

  return changed ? JSON.stringify(bindings, null, 2) : (bindingsJson || '[]');
}

function renameControllerReferencesInSerializedData(data, originalName, nextName) {
  if (!Array.isArray(data) || !originalName || !nextName || originalName === nextName) {
    return;
  }

  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    if (!entry || !entry.__type__) {
      continue;
    }

    if (entry.__type__ === UI_CONTROLLER_SCRIPT_UUID || entry.__type__ === UI_CONTROLLER_DATA_UUID || LEGACY_UI_CONTROLLER_DATA_UUIDS.indexOf(entry.__type__) !== -1) {
      if (entry.previewController === originalName) {
        entry.previewController = nextName;
      }
      if (typeof entry.bindingsJson === 'string') {
        entry.bindingsJson = renameBindingControllerReferences(entry.bindingsJson, originalName, nextName);
      }
      continue;
    }

    if (
      entry.__type__ === UI_CONTROLLER_GEAR_DISPLAY_UUID
      || entry.__type__ === UI_CONTROLLER_GEAR_TEXT_UUID
      || entry.__type__ === UI_CONTROLLER_GEAR_COLOR_UUID
      || entry.__type__ === UI_CONTROLLER_GEAR_POSITION_UUID
      || entry.__type__ === UI_CONTROLLER_GEAR_SIZE_UUID
      || entry.__type__ === UI_CONTROLLER_GEAR_FONT_SIZE_UUID
      || entry.__type__ === UI_CONTROLLER_GEAR_IMAGE_UUID
    ) {
      if (entry.controllerName === originalName || entry._N$controllerName === originalName) {
        if (Object.prototype.hasOwnProperty.call(entry, 'controllerName')) {
          entry.controllerName = nextName;
        }
        if (Object.prototype.hasOwnProperty.call(entry, '_N$controllerName')) {
          entry._N$controllerName = nextName;
        }
      }
    }
  }
}

function resolveLatestPersistenceInfo(payload) {
  return querySelectionPersistenceInfo().then((liveInfo) => {
    if (liveInfo && (liveInfo.sceneUuid || liveInfo.prefabAssetUuid || liveInfo.prefabAssetUrl || liveInfo.rootNodeUuid)) {
      return liveInfo;
    }
    return payload && payload.context ? payload.context : null;
  }).catch(() => {
    return payload && payload.context ? payload.context : null;
  });
}

function isSceneContext(info) {
  if (!info) {
    return false;
  }

  return !info.prefabAssetUuid && !info.prefabAssetUrl && !!info.sceneUuid;
}

function readControllersFromAssetFile(payload) {
  return resolveLatestPersistenceInfo(payload).then((info) => {
    const assetPath = resolveEditingAssetPath(info);
    if (!assetPath || !fs.existsSync(assetPath)) {
      return [];
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(assetPath, 'utf8'));
    }
    catch (error) {
      return [];
    }

    if (!Array.isArray(data) || !data.length) {
      return [];
    }

    const supportedTypes = {};
    supportedTypes[UI_CONTROLLER_SCRIPT_UUID] = true;
    supportedTypes[UI_CONTROLLER_DATA_UUID] = true;
    for (let i = 0; i < LEGACY_UI_CONTROLLER_DATA_UUIDS.length; i++) {
      supportedTypes[LEGACY_UI_CONTROLLER_DATA_UUIDS[i]] = true;
    }

    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      if (entry && supportedTypes[entry.__type__]) {
        return parseControllersJson(entry.controllersJson);
      }
    }

    return [];
  }).catch(() => {
    return [];
  });
}

function mergeControllerList(baseControllers, payload) {
  const controllers = Array.isArray(baseControllers) ? baseControllers.slice() : [];
  const payloadControllers = Array.isArray(payload && payload.controllers) ? payload.controllers.slice() : [];
  const controller = payload && payload.controller ? payload.controller : null;
  const originalName = payload && payload.originalName
    ? payload.originalName
    : (controller && controller.name ? controller.name : '');

  for (let i = 0; i < payloadControllers.length; i++) {
    const nextController = payloadControllers[i];
    const nextName = nextController && nextController.name ? nextController.name : '';
    if (!nextName) {
      continue;
    }

    let replaced = false;
    for (let j = 0; j < controllers.length; j++) {
      const existingName = controllers[j] && controllers[j].name ? controllers[j].name : '';
      if (existingName === nextName) {
        controllers[j] = nextController;
        replaced = true;
        break;
      }
    }

    if (!replaced) {
      controllers.push(nextController);
    }
  }

  if (controller) {
    let updated = false;
    const matchName = originalName || (controller.name || '');
    for (let i = 0; i < controllers.length; i++) {
      const existingName = controllers[i] && controllers[i].name ? controllers[i].name : '';
      if (existingName === matchName || existingName === (controller.name || '')) {
        controllers[i] = controller;
        updated = true;
        break;
      }
    }

    if (!updated) {
      controllers.push(controller);
    }
  }

  const dedupedMap = {};
  const dedupedControllers = [];
  for (let i = 0; i < controllers.length; i++) {
    const currentController = controllers[i];
    const currentName = currentController && currentController.name ? currentController.name : '';
    if (!currentName) {
      continue;
    }
    dedupedMap[currentName] = currentController;
  }

  Object.keys(dedupedMap).forEach((name) => {
    dedupedControllers.push(dedupedMap[name]);
  });

  return dedupedControllers;
}

function persistControllersToAssetFile(payload) {
  return resolveLatestPersistenceInfo(payload).then((info) => {
    const assetPath = resolveEditingAssetPath(info);
    if (!assetPath) {
      Editor.warn('[fairy-controller-editor] persist asset file skipped: no asset path');
      mirrorDebugLog('save-skip-no-asset-path', {
        context: info || null,
        controllerName: payload && payload.controller ? (payload.controller.name || '') : '',
      });
      return false;
    }

    const renameOriginalName = payload && payload.originalName ? payload.originalName : '';
    const renameNextName = payload && payload.controller && payload.controller.name ? payload.controller.name : '';
    const nextInfo = Object.assign({}, info || {}, {
      __fairyRenameOriginalName: renameOriginalName,
      __fairyRenameNextName: renameNextName,
    });

    const result = ensureFileControllerData(assetPath, nextInfo, (component) => {
      const controllers = Array.isArray(payload && payload.controllers)
        ? payload.controllers.slice()
        : mergeControllerList(parseControllersJson(component.controllersJson), payload);
      const controller = payload && payload.controller ? payload.controller : null;
      component.controllersJson = JSON.stringify(controllers, null, 2);
      component.previewController = controller && controller.name ? controller.name : (component.previewController || '');
      component.previewPage = payload && payload.selectedPage ? payload.selectedPage : (component.previewPage || '');
    });
    Editor.log('[fairy-controller-editor] persist asset file:', assetPath, result ? 'ok' : 'failed');
    mirrorDebugLog('save-asset-file', {
      assetPath,
      context: info || null,
      result,
      controllerCount: Array.isArray(payload && payload.controllers) ? payload.controllers.length : -1,
      controllerName: payload && payload.controller ? (payload.controller.name || '') : '',
    });
    return result;
  }).catch((error) => {
    Editor.warn('[fairy-controller-editor] persist asset file failed: ' + error.message);
    mirrorDebugLog('save-asset-file-failed', {
      message: error.message,
    });
    return false;
  });
}

function deleteControllerFromAssetFile(payload) {
  return resolveLatestPersistenceInfo(payload).then((info) => {
    const assetPath = resolveEditingAssetPath(info);
    if (!assetPath) {
      Editor.warn('[fairy-controller-editor] delete asset file skipped: no asset path');
      mirrorDebugLog('delete-skip-no-asset-path', {
        context: info || null,
        controllerName: payload && payload.controllerName ? payload.controllerName : '',
      });
      return false;
    }

    const result = ensureFileControllerData(assetPath, info, (component) => {
      const controllers = Array.isArray(payload && payload.controllers)
        ? payload.controllers.slice()
        : parseControllersJson(component.controllersJson).filter((controller) => {
          return controller && controller.name !== payload.controllerName;
        });

      component.controllersJson = JSON.stringify(controllers, null, 2);
      component.previewController = controllers.length ? (controllers[0].name || '') : '';
      component.previewPage = controllers.length && controllers[0].pages && controllers[0].pages.length
        ? (controllers[0].pages[0].name || '')
        : '';
    });
    Editor.log('[fairy-controller-editor] delete asset file:', assetPath, result ? 'ok' : 'failed');
    mirrorDebugLog('delete-asset-file', {
      assetPath,
      context: info || null,
      result,
      controllerCount: Array.isArray(payload && payload.controllers) ? payload.controllers.length : -1,
      controllerName: payload && payload.controllerName ? payload.controllerName : '',
    });
    return result;
  }).catch((error) => {
    Editor.warn('[fairy-controller-editor] delete asset file failed: ' + error.message);
    mirrorDebugLog('delete-asset-file-failed', {
      message: error.message,
    });
    return false;
  });
}

function persistControllersToSelection(payload) {
  const serializedPayload = JSON.stringify(payload || {});
  const windows = electron.BrowserWindow.getAllWindows();
  if (!windows || !windows.length) {
    persistControllersToAssetFile(payload);
    return Promise.resolve();
  }

  const script = `
    (function () {
      if (!window.cc || !cc.director) {
        return false;
      }

      function getUIControllerDataClass() {
        if (!cc.js || !cc.js.getClassByName) {
          return null;
        }

        return cc.js.getClassByName('UIControllerData');
      }

      function getStorageScene() {
        return cc.director.getScene && cc.director.getScene();
      }

      function getSelectedNode() {
        if (!window.Editor || !Editor.Selection || !Editor.Selection.curActivate) {
          return null;
        }

        var scene = getStorageScene();
        var uuid = Editor.Selection.curActivate('node') || '';
        if (!scene || !uuid) {
          return null;
        }

        if (scene.uuid === uuid) {
          return scene;
        }

        if (scene.getChildByUuid) {
          var directMatch = scene.getChildByUuid(uuid);
          if (directMatch) {
            return directMatch;
          }
        }

        var stack = scene.children ? scene.children.slice() : [];
        while (stack.length) {
          var current = stack.shift();
          if (!current || !cc.isValid(current, true)) {
            continue;
          }
          if (current.uuid === uuid) {
            return current;
          }
          if (current.children && current.children.length) {
            for (var i = 0; i < current.children.length; i++) {
              stack.push(current.children[i]);
            }
          }
        }

        return null;
      }

      function getRootEditingNode() {
        var scene = getStorageScene();
        var selectedNode = getSelectedNode();
        if (!scene || !selectedNode) {
          return null;
        }

        var current = selectedNode;
        while (current && current.parent && current.parent !== scene) {
          current = current.parent;
        }

        return current || null;
      }

      function getStorageNode() {
        var scene = getStorageScene();
        if (!scene) {
          return null;
        }

        var rootEditingNode = getRootEditingNode();
        if (rootEditingNode && cc.isValid(rootEditingNode, true)) {
          return rootEditingNode;
        }

        var children = scene.children || [];
        for (var i = 0; i < children.length; i++) {
          if (children[i] && cc.isValid(children[i], true)) {
            return children[i];
          }
        }

        return scene;
      }

      function getComponentByClassOrName(node, klass, name) {
        if (!node) {
          return null;
        }

        if (klass) {
          return node.getComponent(klass) || null;
        }

        return node.getComponent(name) || null;
      }

      function renameBindingControllerReferences(bindingsJson, originalName, nextName) {
        if (!originalName || !nextName || originalName === nextName) {
          return bindingsJson || '[]';
        }

        var bindings;
        try {
          bindings = JSON.parse(bindingsJson || '[]');
        }
        catch (error) {
          return bindingsJson || '[]';
        }

        if (!Array.isArray(bindings)) {
          return bindingsJson || '[]';
        }

        var changed = false;
        for (var i = 0; i < bindings.length; i++) {
          var binding = bindings[i];
          if (!binding || binding.type !== 'display') {
            continue;
          }

          if (binding.controllerName === originalName) {
            binding.controllerName = nextName;
            changed = true;
          }

          var values = binding.values || null;
          var conditions = values && Array.isArray(values.conditions) ? values.conditions : [];
          for (var j = 0; j < conditions.length; j++) {
            if (conditions[j] && conditions[j].controllerName === originalName) {
              conditions[j].controllerName = nextName;
              changed = true;
            }
          }
        }

        return changed ? JSON.stringify(bindings, null, 2) : (bindingsJson || '[]');
      }

      function renameControllerReferencesInScene(rootNode, originalName, nextName) {
        if (!rootNode || !originalName || !nextName || originalName === nextName) {
          return;
        }

        var stack = [rootNode];
        while (stack.length) {
          var current = stack.shift();
          if (!current || !cc.isValid(current, true)) {
            continue;
          }

          var displayGear = current.getComponent && current.getComponent('UIControllerGearDisplay');
          if (displayGear && displayGear.controllerName === originalName) {
            displayGear.controllerName = nextName;
          }

          var textGear = current.getComponent && current.getComponent('UIControllerGearText');
          if (textGear && textGear.controllerName === originalName) {
            textGear.controllerName = nextName;
          }

          var colorGear = current.getComponent && current.getComponent('UIControllerGearColor');
          if (colorGear && colorGear.controllerName === originalName) {
            colorGear.controllerName = nextName;
          }

          var positionGear = current.getComponent && current.getComponent('UIControllerGearPosition');
          if (positionGear && positionGear.controllerName === originalName) {
            positionGear.controllerName = nextName;
          }

          var sizeGear = current.getComponent && current.getComponent('UIControllerGearSize');
          if (sizeGear && sizeGear.controllerName === originalName) {
            sizeGear.controllerName = nextName;
          }

          var fontSizeGear = current.getComponent && current.getComponent('UIControllerGearFontSize');
          if (fontSizeGear && fontSizeGear.controllerName === originalName) {
            fontSizeGear.controllerName = nextName;
          }

          var imageGear = current.getComponent && current.getComponent('UIControllerGearImage');
          if (imageGear && imageGear.controllerName === originalName) {
            imageGear.controllerName = nextName;
          }

          if (current.children && current.children.length) {
            for (var i = 0; i < current.children.length; i++) {
              stack.push(current.children[i]);
            }
          }
        }
      }

      var payload = ${serializedPayload};
      var node = getStorageNode();
      if (!node) {
        return false;
      }

      var scene = getStorageScene();
      var klass = getUIControllerDataClass();
      var component = node.getComponent('UIController') || getComponentByClassOrName(node, klass, 'UIControllerData');
      if (!component) {
        component = node.addComponent('UIController');
      }
      if (!component) {
        return false;
      }

      var legacyComponent = scene && scene !== node
        ? (scene.getComponent('UIController') || getComponentByClassOrName(scene, klass, 'UIControllerData'))
        : null;

      var controllers = Array.isArray(payload.controllers) ? payload.controllers.slice() : [];
      var controller = payload.controller || null;

      if (component.updateControllers) {
        component.updateControllers(controllers, true);
      }
      else {
        component.controllersJson = JSON.stringify(controllers, null, 2);
      }
      if (payload.originalName && controller && controller.name && payload.originalName !== controller.name) {
        component.bindingsJson = renameBindingControllerReferences(component.bindingsJson || '[]', payload.originalName, controller.name);
        renameControllerReferencesInScene(node, payload.originalName, controller.name);
      }
      component.previewController = controller && controller.name ? controller.name : (component.previewController || '');
      component.previewPage = payload.selectedPage || component.previewPage || '';
      if (component.setPreview) {
        component.setPreview(component.previewController || '', component.previewPage || '');
      }
      else if (component.applyAll) {
        component.applyAll();
      }

      if (legacyComponent && legacyComponent !== component && cc.isValid(legacyComponent, true)) {
        legacyComponent.destroy();
      }
      return true;
    })();
  `;

  const tasks = [];
  windows.forEach((win) => {
    if (!win || win.isDestroyed()) {
      return;
    }

    tasks.push(win.webContents.executeJavaScript(script).catch((error) => {
      Editor.warn('[fairy-controller-editor] persist controllers failed: ' + error.message);
    }));
  });

  return Promise.all(tasks).then(() => {
    return resolveLatestPersistenceInfo(payload).then((info) => {
      if (isSceneContext(info)) {
        requestSceneSave();
      }
      return persistControllersToAssetFile(Object.assign({}, payload, {
        context: info || (payload && payload.context) || null,
      }));
    });
  });
}

function deleteControllerFromSelection(payload) {
  const serializedPayload = JSON.stringify(payload || {});
  const windows = electron.BrowserWindow.getAllWindows();
  if (!windows || !windows.length) {
    deleteControllerFromAssetFile(payload || {});
    return Promise.resolve();
  }

  const script = `
    (function () {
      if (!window.cc || !cc.director) {
        return false;
      }

      function getUIControllerDataClass() {
        if (!cc.js || !cc.js.getClassByName) {
          return null;
        }

        return cc.js.getClassByName('UIControllerData');
      }

      function getStorageScene() {
        return cc.director.getScene && cc.director.getScene();
      }

      function getSelectedNode() {
        if (!window.Editor || !Editor.Selection || !Editor.Selection.curActivate) {
          return null;
        }

        var scene = getStorageScene();
        var uuid = Editor.Selection.curActivate('node') || '';
        if (!scene || !uuid) {
          return null;
        }

        if (scene.uuid === uuid) {
          return scene;
        }

        if (scene.getChildByUuid) {
          var directMatch = scene.getChildByUuid(uuid);
          if (directMatch) {
            return directMatch;
          }
        }

        var stack = scene.children ? scene.children.slice() : [];
        while (stack.length) {
          var current = stack.shift();
          if (!current || !cc.isValid(current, true)) {
            continue;
          }
          if (current.uuid === uuid) {
            return current;
          }
          if (current.children && current.children.length) {
            for (var i = 0; i < current.children.length; i++) {
              stack.push(current.children[i]);
            }
          }
        }

        return null;
      }

      function getRootEditingNode() {
        var scene = getStorageScene();
        var selectedNode = getSelectedNode();
        if (!scene || !selectedNode) {
          return null;
        }

        var current = selectedNode;
        while (current && current.parent && current.parent !== scene) {
          current = current.parent;
        }

        return current || null;
      }

      function getStorageNode() {
        var scene = getStorageScene();
        if (!scene) {
          return null;
        }

        var rootEditingNode = getRootEditingNode();
        if (rootEditingNode && cc.isValid(rootEditingNode, true)) {
          return rootEditingNode;
        }

        var children = scene.children || [];
        for (var i = 0; i < children.length; i++) {
          if (children[i] && cc.isValid(children[i], true)) {
            return children[i];
          }
        }

        return scene;
      }

      function getComponentByClassOrName(node, klass, name) {
        if (!node) {
          return null;
        }

        if (klass) {
          return node.getComponent(klass) || null;
        }

        return node.getComponent(name) || null;
      }

      var payload = ${serializedPayload};
      var node = getStorageNode();
      if (!node) {
        return false;
      }

      var scene = getStorageScene();
      var klass = getUIControllerDataClass();
      var component = node.getComponent('UIController') || getComponentByClassOrName(node, klass, 'UIControllerData');
      var legacyComponent = scene && scene !== node
        ? (scene.getComponent('UIController') || getComponentByClassOrName(scene, klass, 'UIControllerData'))
        : null;
      if (!component) {
        component = legacyComponent;
      }
      if (!component) {
        return false;
      }

      var controllers = Array.isArray(payload.controllers) ? payload.controllers.slice() : [];
      if (!controllers.length && payload.controllerName) {
        try {
          controllers = JSON.parse(component.controllersJson || '[]');
        }
        catch (error) {
          controllers = [];
        }

        controllers = controllers.filter(function (controller) {
          return controller && controller.name !== payload.controllerName;
        });
      }

      if (component.updateControllers) {
        component.updateControllers(controllers, true);
      }
      else {
        component.controllersJson = JSON.stringify(controllers, null, 2);
      }
      component.previewController = controllers.length ? (controllers[0].name || '') : '';
      component.previewPage = controllers.length && controllers[0].pages && controllers[0].pages.length
        ? (controllers[0].pages[0].name || '')
        : '';
      if (component.setPreview) {
        component.setPreview(component.previewController || '', component.previewPage || '');
      }
      else if (component.applyAll) {
        component.applyAll();
      }

      if (legacyComponent && legacyComponent !== component && cc.isValid(legacyComponent, true)) {
        legacyComponent.destroy();
      }
      return true;
    })();
  `;

  const tasks = [];
  windows.forEach((win) => {
    if (!win || win.isDestroyed()) {
      return;
    }

    tasks.push(win.webContents.executeJavaScript(script).catch(() => { }));
  });

  return Promise.all(tasks).then(() => {
    return resolveLatestPersistenceInfo(payload).then((info) => {
      if (isSceneContext(info)) {
        requestSceneSave();
      }
      return deleteControllerFromAssetFile(Object.assign({}, payload || {}, {
        context: info || (payload && payload.context) || null,
      }));
    });
  });
}

module.exports = {
  load() {
    injectToolbar();
    syncToolbarState(toolbarState);
    injectTimer = setInterval(injectToolbar, 2000);
  },

  unload() {
    if (injectTimer) {
      clearInterval(injectTimer);
      injectTimer = null;
    }
  },

  messages: {
    'open-create-panel'(event, payload) {
      global.__fairyControllerPanelPayload = payload || {};
      Editor.Panel.close('fairy-controller-editor');
      setTimeout(() => {
        Editor.Panel.open('fairy-controller-editor');
        setTimeout(() => {
          moveEditorPanelUp();
        }, 80);
      }, 0);
    },

    'save-controllers'(event, payload) {
      const controller = payload && payload.controller ? payload.controller : null;
      if (controller) {
        const dedupedControllers = mergeControllerList(toolbarState.controllers, payload);
        const nextPayload = Object.assign({}, payload, {
          controllers: dedupedControllers,
        });

        syncToolbarState({
          controllers: dedupedControllers,
          currentController: controller.name || '',
          context: payload && payload.context ? payload.context : toolbarState.context,
        });
        persistControllersToSelection(nextPayload);
        Editor.Message.broadcast('fairy-controller-editor:save-controllers', nextPayload);
        return;
      }
      Editor.Message.broadcast('fairy-controller-editor:save-controllers', payload || {});
    },

    'delete-controller'(event, payload) {
      const controllerName = payload && payload.controllerName ? payload.controllerName : '';
      readControllersFromAssetFile(payload).then((assetControllers) => {
        const fallbackControllers = Array.isArray(payload && payload.controllers) ? payload.controllers : toolbarState.controllers;
        const baseControllers = assetControllers.length ? assetControllers : fallbackControllers;
        const controllers = baseControllers.filter((controller) => {
          return controller && controller.name !== controllerName;
        });
        mirrorDebugLog('delete-controller-message', {
          controllerName,
          beforeCount: Array.isArray(baseControllers) ? baseControllers.length : -1,
          afterCount: controllers.length,
          beforeNames: Array.isArray(baseControllers) ? baseControllers.map((controller) => controller && controller.name ? controller.name : '') : [],
          afterNames: controllers.map((controller) => controller && controller.name ? controller.name : ''),
        });
        const nextPayload = Object.assign({}, payload, {
          controllers,
        });
        syncToolbarState({
          controllers,
          currentController: controllers.length ? (controllers[0].name || '') : '',
          context: payload && payload.context ? payload.context : toolbarState.context,
        });
        deleteControllerFromSelection(nextPayload);
        Editor.Message.broadcast('fairy-controller-editor:delete-controller', nextPayload);
      });
    },

    'sync-toolbar-state'(event, payload) {
      syncToolbarState(payload || {});
    }
  }
};
