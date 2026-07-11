const electron = require('electron');

Editor.Panel.extend({
  style: `
    :host {
      margin: 0;
      padding: 12px;
      color: #c9c9c9;
    }

    .layout {
      display: flex;
      flex-direction: column;
      gap: 10px;
      height: 100%;
    }

    .row {
      display: flex;
      gap: 12px;
    }

    .row > ui-prop {
      flex: 1;
    }

    .toolbar {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .toolbar .spacer {
      flex: 1;
    }

    .page-list {
      flex: 1;
      overflow: auto;
      border: 1px solid #3d3d3d;
      background: #262626;
      padding: 8px;
    }

    .page-header,
    .page-item {
      display: grid;
      grid-template-columns: 48px 1fr 1fr;
      gap: 8px;
      align-items: center;
    }

    .page-header {
      margin-bottom: 8px;
      color: #8f8f8f;
      font-size: 12px;
    }

    .page-item {
      margin-bottom: 8px;
      padding: 4px;
    }

    .page-item.active {
      background: #31476a;
    }

    .page-actions {
      display: flex;
      gap: 6px;
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }

    .footer .spacer {
      flex: 1;
    }
  `,

  template: `
    <div class="layout">
      <div class="row">
        <ui-prop name="名称" class="fixed-label">
          <ui-input id="controllerName" class="flex-1"></ui-input>
        </ui-prop>
        <ui-prop name="备注" class="fixed-label">
          <ui-input id="controllerRemark" class="flex-1"></ui-input>
        </ui-prop>
      </div>

      <div class="toolbar">
        <span>页面</span>
        <ui-button id="addPage">+</ui-button>
        <ui-button id="removePage">-</ui-button>
        <div class="spacer"></div>
        <ui-button id="movePageUp">上移</ui-button>
        <ui-button id="movePageDown">下移</ui-button>
      </div>

      <div id="pageList" class="page-list"></div>

      <div class="footer">
        <ui-button id="delete">删除控制器</ui-button>
        <div class="spacer"></div>
        <ui-button id="cancel">取消</ui-button>
        <ui-button id="save" class="blue">保存</ui-button>
      </div>
    </div>
  `,

  $: {
    controllerName: '#controllerName',
    controllerRemark: '#controllerRemark',
    addPage: '#addPage',
    removePage: '#removePage',
    movePageUp: '#movePageUp',
    movePageDown: '#movePageDown',
    pageList: '#pageList',
    delete: '#delete',
    cancel: '#cancel',
    save: '#save'
  },

  ready () {
    this._payload = {};
    this._pages = [];
    this._selectedPageIndex = -1;
    this._isReady = true;
    this._actionLocked = false;

    this.$addPage.addEventListener('confirm', () => {
      this._flushPageInputs();
      this._pages.push({
        name: '',
        remark: ''
      });
      this._selectedPageIndex = this._pages.length - 1;
      this._renderPages();
    });

    this.$removePage.addEventListener('confirm', () => {
      this._flushPageInputs();
      if (this._selectedPageIndex < 0 || this._selectedPageIndex >= this._pages.length) {
        return;
      }
      this._pages.splice(this._selectedPageIndex, 1);
      this._selectedPageIndex = this._pages.length
        ? Math.min(this._selectedPageIndex, this._pages.length - 1)
        : -1;
      this._renderPages();
    });

    this.$movePageUp.addEventListener('confirm', () => {
      this._movePage(-1);
    });

    this.$movePageDown.addEventListener('confirm', () => {
      this._movePage(1);
    });

    this.$cancel.addEventListener('confirm', () => {
      Editor.Panel.close('fairy-controller-editor');
    });

    this.$delete.addEventListener('confirm', () => {
      this._deleteController();
    });

    this.$save.addEventListener('confirm', () => {
      this._save();
    });

    var initialPayload = this._pendingPayload || this._readMainPayload();
    if (initialPayload) {
      this._applyPayload(initialPayload);
      this._pendingPayload = null;
    }
  },

  update (payload) {
    var nextPayload = payload || this._readMainPayload() || {};
    if (!this._isReady) {
      this._pendingPayload = nextPayload;
      return;
    }

    this._applyPayload(nextPayload);
  },

  _readMainPayload () {
    if (!electron || !electron.remote || !electron.remote.getGlobal) {
      return null;
    }

    var payload = electron.remote.getGlobal('__fairyControllerPanelPayload');
    return payload ? JSON.parse(JSON.stringify(payload)) : null;
  },

  _applyPayload (payload) {
    this._payload = payload || {};
    var controller = this._payload.editingController || null;

    this._setUIInputValue(this.$controllerName, controller ? (controller.name || '') : '');
    this._setUIInputValue(this.$controllerRemark, controller ? (controller.remark || '') : '');
    this.$delete.hidden = !controller;
    this._pages = controller && controller.pages ? JSON.parse(JSON.stringify(controller.pages)) : [];
    this._selectedPageIndex = this._pages.length ? 0 : -1;
    this._renderPages();
  },

  _setUIInputValue (element, value) {
    if (!element) {
      return;
    }

    var nextValue = value || '';
    element.value = nextValue;
    element.setAttribute('value', nextValue);

    if (element.shadowRoot) {
      var nativeInput = element.shadowRoot.querySelector('input, textarea');
      if (nativeInput) {
        nativeInput.value = nextValue;
      }
    }
  },

  _renderPages () {
    this.$pageList.innerHTML = '';

    var header = document.createElement('div');
    header.className = 'page-header';
    header.innerHTML = `
      <span>索引</span>
      <span>名称</span>
      <span>备注</span>
    `;
    this.$pageList.appendChild(header);

    for (let i = 0; i < this._pages.length; i++) {
      const page = this._pages[i];
      const row = document.createElement('div');
      row.className = 'page-item' + (i === this._selectedPageIndex ? ' active' : '');
      row.setAttribute('data-index', String(i));
      row.innerHTML = `
        <span>${i}</span>
        <ui-input data-key="name" data-index="${i}"></ui-input>
        <ui-input data-key="remark" data-index="${i}"></ui-input>
      `;
      row.addEventListener('click', () => {
        this._flushPageInputs();
        this._selectedPageIndex = i;
        this._renderPages();
      });
      this.$pageList.appendChild(row);

      var rowInputs = row.querySelectorAll('ui-input');
      this._setUIInputValue(rowInputs[0], page.name || '');
      this._setUIInputValue(rowInputs[1], page.remark || '');
    }

    var inputs = this.$pageList.querySelectorAll('ui-input');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('click', (event) => {
        event.stopPropagation();
      });
      inputs[i].addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });
      inputs[i].addEventListener('input', (event) => {
        var index = Number(event.target.getAttribute('data-index'));
        var key = event.target.getAttribute('data-key');
        this._pages[index][key] = event.target.value;
      });
      inputs[i].addEventListener('confirm', (event) => {
        var index = Number(event.target.getAttribute('data-index'));
        var key = event.target.getAttribute('data-key');
        this._pages[index][key] = event.target.value;
      });
    }
  },

  _flushPageInputs () {
    var inputs = this.$pageList ? this.$pageList.querySelectorAll('ui-input') : [];
    for (var i = 0; i < inputs.length; i++) {
      var index = Number(inputs[i].getAttribute('data-index'));
      var key = inputs[i].getAttribute('data-key');
      if (!this._pages[index]) {
        continue;
      }
      var value = '';
      if (typeof inputs[i].value === 'string') {
        value = inputs[i].value;
      }
      else if (inputs[i].shadowRoot) {
        var nativeInput = inputs[i].shadowRoot.querySelector('input, textarea');
        value = nativeInput ? (nativeInput.value || '') : '';
      }
      this._pages[index][key] = value;
    }
  },

  _movePage (offset) {
    this._flushPageInputs();
    var from = this._selectedPageIndex;
    var to = from + offset;
    if (from < 0 || from >= this._pages.length || to < 0 || to >= this._pages.length) {
      return;
    }

    var page = this._pages.splice(from, 1)[0];
    this._pages.splice(to, 0, page);
    this._selectedPageIndex = to;
    this._renderPages();
  },

  _save () {
    if (this._actionLocked) {
      return;
    }
    this._actionLocked = true;
    this._flushPageInputs();
    var currentPayload = this._payload || {};
    var originalName = currentPayload.editingController ? (currentPayload.editingController.name || '') : '';
    var controllerName = (this.$controllerName.value || '').trim() || 'controller';
    var controllers = currentPayload.controllers || [];
    var selectedIndex = 0;
    if (currentPayload.editingController && typeof currentPayload.editingController.selectedIndex === 'number') {
      selectedIndex = currentPayload.editingController.selectedIndex;
    }
    for (var matchedIndex = 0; matchedIndex < controllers.length; matchedIndex++) {
      var matchedController = controllers[matchedIndex];
      if (matchedController && matchedController.name === (originalName || controllerName)) {
        if (typeof matchedController.selectedIndex === 'number') {
          selectedIndex = matchedController.selectedIndex;
        }
        break;
      }
    }
    for (var i = 0; i < controllers.length; i++) {
      var name = controllers[i] && controllers[i].name ? controllers[i].name : '';
      if (!name || name === originalName) {
        continue;
      }
      if (name === controllerName) {
        Editor.warn('控制器名称已存在: ' + controllerName);
        return;
      }
    }

    var payload = Object.assign({}, currentPayload, {
      originalName: originalName,
      selectedPage: this._selectedPageIndex >= 0 && this._pages[this._selectedPageIndex]
        ? (this._pages[this._selectedPageIndex].id || this._pages[this._selectedPageIndex].name || String(this._selectedPageIndex))
        : '',
      controller: {
        name: controllerName,
        remark: this.$controllerRemark.value || '',
        selectedIndex: selectedIndex,
        pages: this._pages.map((page, index) => {
          return {
            id: page.id || ('page-' + index),
            name: page.name || '',
            remark: page.remark || ''
          };
        })
      }
    });

    Editor.Ipc.sendToMain('fairy-controller-editor:save-controllers', payload);
    Editor.Panel.close('fairy-controller-editor');
  },

  _deleteController () {
    if (this._actionLocked) {
      return;
    }
    this._actionLocked = true;
    var currentPayload = this._payload || {};
    var editingController = currentPayload.editingController || null;
    var visibleName = (this.$controllerName && this.$controllerName.value ? this.$controllerName.value : '').trim();
    var controllerName = visibleName || (editingController && editingController.name) || '';
    if (!controllerName) {
      return;
    }

    Editor.Ipc.sendToMain('fairy-controller-editor:delete-controller', {
      controllerName: controllerName,
      controllers: currentPayload.controllers || [],
      context: currentPayload.context || null
    });
    Editor.Panel.close('fairy-controller-editor');
  }
});
