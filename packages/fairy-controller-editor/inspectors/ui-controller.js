Vue.component('ui-controller', {
    template: `
    <div class="ui-controller-inspector">
      <style>
        .ui-controller-inspector .controller-strip {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin: 8px 0;
        }

        .ui-controller-inspector .controller-chip {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          background: #2d2d2d;
          border: 1px solid #4a4a4a;
          cursor: pointer;
        }

        .ui-controller-inspector .controller-chip.active {
          border-color: #d08a2d;
        }

        .ui-controller-inspector .controller-chip-label,
        .ui-controller-inspector .controller-chip-page,
        .ui-controller-inspector .controller-add {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-right: 1px solid #4a4a4a;
        }

        .ui-controller-inspector .controller-chip-label:last-child,
        .ui-controller-inspector .controller-chip-page:last-child {
          border-right: 0;
        }

        .ui-controller-inspector .controller-chip-badge {
          color: #d7d7d7;
          margin-right: 8px;
          font-weight: bold;
        }

        .ui-controller-inspector .controller-chip-name {
          font-weight: bold;
        }

        .ui-controller-inspector .controller-chip-page {
          color: #d08a2d;
        }

        .ui-controller-inspector .controller-add {
          background: #3b3b3b;
          border: 1px solid #4a4a4a;
          color: #c9c9c9;
          cursor: pointer;
        }

        .ui-controller-inspector .controller-select {
          width: 100%;
          min-height: 24px;
          color: #c9c9c9;
          background: #2a2a2a;
          border: 1px solid #444;
        }

        .ui-controller-inspector .controller-empty {
          color: #8f8f8f;
          padding: 8px 0 2px;
        }
      </style>
      <ui-section header="控制器" expand>
        <div class="controller-strip">
          <div
            v-for="controller in displayControllers"
            class="controller-chip"
            :class="{ active: controller.name === currentController }"
            @click="_openController(controller.name)"
          >
            <span class="controller-chip-label">
              <span class="controller-chip-badge">C</span>
              <span class="controller-chip-name">{{controller.name}}</span>
            </span>
            <span
              v-for="(page, index) in controller.pages || []"
              class="controller-chip-page"
            >{{index}}:{{page.name || ''}}</span>
          </div>

          <div class="controller-add" @click="_openCreatePanel()">+ 增加控制器</div>
        </div>

        <ui-prop>
          <span slot="label">当前页面</span>
          <select class="controller-select" @change="_onPageChange($event)">
            <option v-for="name in currentPages" :value="name" :selected="name === currentPage">{{name}}</option>
          </select>
        </ui-prop>

        <div v-if="!displayControllers.length" class="controller-empty">当前还没有控制器，点击“+ 增加控制器”开始配置。</div>
      </ui-section>
    </div>
  `,

    props: {
        target: {
            twoWay: true,
            type: Object
        }
    },

    data: function () {
        return {
            controllers: []
        };
    },

    computed: {
        displayControllers: function () {
            return this.controllers || [];
        },

        controllerNames: function () {
            return this.displayControllers.map(function (item) {
                return item.name;
            });
        },

        currentController: function () {
            return this.target.previewController.value || (this.controllerNames[0] || '');
        },

        currentPages: function () {
            var controller = this._getController(this.currentController);
            if (!controller || !controller.pages) {
                return [];
            }
            return controller.pages.map(function (page) {
                return page.name || '';
            });
        },

        currentPage: function () {
            return this.target.previewPage.value || (this.currentPages[0] || '');
        }
    },

    created: function () {
        this._syncFromDump();
        this._onSaveControllers = this._handleSaveControllers.bind(this);
        this._onDeleteController = this._handleDeleteController.bind(this);
        Editor.Message.addBroadcastListener('fairy-controller-editor:save-controllers', this._onSaveControllers);
        Editor.Message.addBroadcastListener('fairy-controller-editor:delete-controller', this._onDeleteController);
    },

    detached: function () {
        if (this._onSaveControllers) {
            Editor.Message.removeBroadcastListener('fairy-controller-editor:save-controllers', this._onSaveControllers);
        }
        if (this._onDeleteController) {
            Editor.Message.removeBroadcastListener('fairy-controller-editor:delete-controller', this._onDeleteController);
        }
    },

    methods: {
        _syncFromDump: function () {
            try {
                this.controllers = JSON.parse(this.target.controllersJson.value || '[]');
            }
            catch (error) {
                this.controllers = [];
            }

            this._syncToolbarState();

            if (this.$forceUpdate) {
                this.$forceUpdate();
            }
        },

        _syncToolbarState: function () {
            Editor.Ipc.sendToMain('fairy-controller-editor:sync-toolbar-state', {
                controllers: JSON.parse(JSON.stringify(this.displayControllers || [])),
                currentController: this.currentController || '',
                currentPage: this.currentPage || ''
            });
        },

        _getController: function (name) {
            for (var i = 0; i < this.displayControllers.length; i++) {
                if (this.displayControllers[i].name === name) {
                    return this.displayControllers[i];
                }
            }
            return null;
        },

        _openCreatePanel: function () {
            Editor.Ipc.sendToMain('fairy-controller-editor:open-create-panel', {
                mode: 'create',
                controllers: JSON.parse(JSON.stringify(this.displayControllers))
            });
        },

        _openEditPanel: function (controllerName) {
            var controller = this._getController(controllerName || this.currentController);
            if (!controller) {
                return;
            }

            Editor.Ipc.sendToMain('fairy-controller-editor:open-create-panel', {
                mode: 'edit',
                controllers: JSON.parse(JSON.stringify(this.displayControllers)),
                editingController: JSON.parse(JSON.stringify(controller))
            });
        },

        _openController: function (controllerName) {
            if (!controllerName) {
                return;
            }
            this._setCurrentSelection(controllerName, '');
            this._openEditPanel(controllerName);
        },

        _onPageChange: function (event) {
            this._setDumpValue(this.target.previewPage, event.target.value || '');
        },

        _handleSaveControllers: function (payload) {
            if (!payload || !payload.controller) {
                return;
            }

            this._syncFromDump();

            var nextControllers = this.controllers.slice();
            var matchName = payload.originalName || payload.controller.name;
            var updated = false;
            for (var i = 0; i < nextControllers.length; i++) {
                if (nextControllers[i].name === matchName) {
                    nextControllers[i] = payload.controller;
                    updated = true;
                    break;
                }
            }

            if (!updated) {
                nextControllers.push(payload.controller);
            }

            this.controllers = JSON.parse(JSON.stringify(nextControllers));
            this._setDumpValue(this.target.controllersJson, JSON.stringify(nextControllers, null, 2));
            this._setCurrentSelection(payload.controller.name || '', payload.selectedPage || '');
            this._syncFromDump();
        },

        _handleDeleteController: function (payload) {
            if (!payload || !payload.controllerName) {
                return;
            }

            this._syncFromDump();

            var nextControllers = this.controllers.filter(function (controller) {
                return controller.name !== payload.controllerName;
            });

            this.controllers = JSON.parse(JSON.stringify(nextControllers));
            this._setDumpValue(this.target.controllersJson, JSON.stringify(nextControllers, null, 2));

            if (this.currentController === payload.controllerName) {
                var nextControllerName = nextControllers.length ? (nextControllers[0].name || '') : '';
                this._setCurrentSelection(nextControllerName, '');
            }

            this._syncFromDump();
        },

        _setCurrentSelection: function (controllerName, pageName) {
            this._setDumpValue(this.target.previewController, controllerName);

            var controller = this._getController(controllerName);
            var nextPage = pageName || '';
            if (controller && controller.pages && controller.pages.length) {
                var exists = false;
                for (var i = 0; i < controller.pages.length; i++) {
                    var currentName = controller.pages[i].name || '';
                    if (currentName === nextPage) {
                        exists = true;
                        break;
                    }
                }

                if (!exists) {
                    nextPage = controller.pages[0].name || '';
                }
            }
            else {
                nextPage = '';
            }

            this._setDumpValue(this.target.previewPage, nextPage);
            this._syncToolbarState();
        },

        _setDumpValue: function (dump, value) {
            if (!dump) {
                return;
            }

            dump.value = value;
            if (dump.values && dump.values.length) {
                for (var i = 0; i < dump.values.length; i++) {
                    dump.values[i] = value;
                }
            }

            if (this.$dispatch) {
                this.$dispatch('change-dump', dump);
                this.$dispatch('confirm-dump', dump);
            }
        }
    },

    watch: {
        'target.controllersJson.value': function () {
            this._syncFromDump();
        }
    }
});
