var UIControllerFontSizeState = cc.Class({
    name: 'UIControllerFontSizeState',
    properties: {
        page: '',
        value: 0
    }
});

cc.Class({
    extends: cc.Component,

    editor: {
        executeInEditMode: true,
        menu: 'Custom/Fairy Gear Font Size'
    },

    properties: {
        controllerName: {
            default: '',
            visible: false,
            notify: function () {
                this.apply();
            }
        },
        defaultValue: {
            default: 0,
            visible: false
        },
        states: {
            default: [],
            type: [UIControllerFontSizeState],
            visible: false,
            notify: function () {
                this.apply();
            }
        }
    },

    onLoad: function () {
        this._lastAppliedPage = '';
        this._lastAppliedValue = 0;
        var textComponent = this._getTextComponent();
        if (!this.defaultValue && textComponent) {
            this.defaultValue = textComponent.fontSize || 0;
        }
        this.apply();
    },

    onEnable: function () {
        this.apply();
    },

    apply: function () {
        var rootController = this._getRootController();
        var textComponent = this._getTextComponent();
        if (!rootController || !textComponent || !this.controllerName) {
            return;
        }

        var state = this._findState(rootController);
        var currentId = rootController.getCurrentPageId
            ? rootController.getCurrentPageId(this.controllerName)
            : rootController.getPageId(this.controllerName, rootController.getCurrentPageName(this.controllerName));
        var currentName = rootController.getCurrentPageName
            ? rootController.getCurrentPageName(this.controllerName)
            : '';
        var currentPage = state
            ? (state.page || '')
            : (currentId || currentName || '');
        var nextValue = state ? state.value : this.defaultValue;

        if (CC_EDITOR && currentPage && this._lastAppliedPage === currentPage) {
            if (textComponent.fontSize !== this._lastAppliedValue) {
                if (state) {
                    state.value = textComponent.fontSize;
                    nextValue = state.value;
                }
                else {
                    this.defaultValue = textComponent.fontSize;
                    nextValue = this.defaultValue;
                }
            }
        }

        if (textComponent.fontSize !== nextValue) {
            textComponent.fontSize = nextValue;
            if (textComponent._updateRenderData) {
                textComponent._updateRenderData(true);
            }
        }
        this._lastAppliedPage = currentPage;
        this._lastAppliedValue = nextValue;
    },

    _getTextComponent: function () {
        return this.getComponent(cc.Label) || (cc.RichText ? this.getComponent(cc.RichText) : null);
    },

    _findState: function (rootController) {
        var currentId = rootController.getCurrentPageId
            ? rootController.getCurrentPageId(this.controllerName)
            : rootController.getPageId(this.controllerName, rootController.getCurrentPageName(this.controllerName));
        var currentName = rootController.getCurrentPageName
            ? rootController.getCurrentPageName(this.controllerName)
            : '';

        for (var i = 0; i < this.states.length; i++) {
            var state = this.states[i];
            if (state.page === currentId || state.page === currentName) {
                return state;
            }
        }

        return null;
    },

    _getRootController: function () {
        var current = this.node;
        while (current) {
            var controller = current.getComponent('UIController');
            if (controller) {
                return controller;
            }
            current = current.parent;
        }
        return null;
    }
});
