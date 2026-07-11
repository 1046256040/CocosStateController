var UIControllerColorState = cc.Class({
    name: 'UIControllerColorState',
    properties: {
        page: '',
        color: {
            default: new cc.Color(255, 255, 255, 255)
        }
    }
});

cc.Class({
    extends: cc.Component,

    editor: {
        executeInEditMode: true,
        menu: 'Custom/Fairy Gear Color'
    },

    properties: {
        controllerName: {
            default: '',
            visible: false,
            notify: function () {
                this.apply();
            }
        },
        defaultColor: {
            visible: false,
            default: new cc.Color(255, 255, 255, 255)
        },
        states: {
            default: [],
            visible: false,
            type: [UIControllerColorState],
            notify: function () {
                this.apply();
            }
        }
    },

    onLoad: function () {
        this._lastAppliedPage = '';
        this._lastAppliedColor = null;
        if (this._isDefaultColorEmpty()) {
            this.defaultColor = this._cloneColor(this.node.color);
        }
        this.apply();
    },

    onEnable: function () {
        this.apply();
    },

    apply: function () {
        var rootController = this._getRootController();
        if (!rootController || !this.controllerName) {
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
        var nextColor = state ? state.color : this.defaultColor;

        if (CC_EDITOR && currentPage && this._lastAppliedPage === currentPage) {
            if (!this._isSameColor(this.node.color, this._lastAppliedColor)) {
                if (state) {
                    state.color = this._cloneColor(this.node.color);
                    nextColor = state.color;
                }
                else {
                    this.defaultColor = this._cloneColor(this.node.color);
                    nextColor = this.defaultColor;
                }
            }
        }

        if (!this._isSameColor(this.node.color, nextColor)) {
            this.node.color = this._cloneColor(nextColor);
        }
        this._lastAppliedPage = currentPage;
        this._lastAppliedColor = this._cloneColor(nextColor);
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

    _cloneColor: function (color) {
        var source = color || new cc.Color(255, 255, 255, 255);
        return new cc.Color(source.r || 0, source.g || 0, source.b || 0, typeof source.a === 'number' ? source.a : 255);
    },

    _isSameColor: function (a, b) {
        if (!a || !b) {
            return false;
        }

        return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
    },

    _isDefaultColorEmpty: function () {
        return this.defaultColor.r === 255
            && this.defaultColor.g === 255
            && this.defaultColor.b === 255
            && this.defaultColor.a === 255;
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
