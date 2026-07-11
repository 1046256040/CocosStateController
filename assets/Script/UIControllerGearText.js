var UIControllerTextState = cc.Class({
    name: 'UIControllerTextState',
    properties: {
        page: '',
        value: ''
    }
});

cc.Class({
    extends: cc.Component,

    editor: {
        executeInEditMode: true,
        menu: 'Custom/Fairy Gear Text'
    },

    properties: {
        controllerName: {
            default: '',
            visible: false,
            notify: function () {
                this.apply();
            }
        },
        targetLabel: {
            default: null,
            type: cc.Label,
            visible: false
        },
        defaultValue: {
            default: '',
            visible: false
        },
        states: {
            default: [],
            type: [UIControllerTextState],
            visible: false,
            notify: function () {
                this.apply();
            }
        }
    },

    onLoad: function () {
        this._lastAppliedPage = '';
        this._lastAppliedValue = '';
        if (!this.targetLabel) {
            this.targetLabel = this.getComponent(cc.Label);
        }
        if (!this.defaultValue && this.targetLabel) {
            this.defaultValue = this.targetLabel.string;
        }
        this.apply();
    },

    onEnable: function () {
        this.apply();
    },

    apply: function () {
        var rootController = this._getRootController();
        if (!rootController || !this.targetLabel || !this.controllerName) {
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
            if (this.targetLabel.string !== this._lastAppliedValue) {
                if (state) {
                    state.value = this.targetLabel.string;
                    nextValue = state.value;
                }
                else {
                    this.defaultValue = this.targetLabel.string;
                    nextValue = this.defaultValue;
                }
            }
        }

        if (this.targetLabel.string !== nextValue) {
            this.targetLabel.string = nextValue;
        }
        this._lastAppliedPage = currentPage;
        this._lastAppliedValue = nextValue;
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
