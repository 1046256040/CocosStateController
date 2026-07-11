var UIControllerSizeState = cc.Class({
    name: 'UIControllerSizeState',
    properties: {
        page: '',
        width: 0,
        height: 0,
        scaleX: 1,
        scaleY: 1
    }
});

cc.Class({
    extends: cc.Component,

    editor: {
        executeInEditMode: true,
        menu: 'Custom/Fairy Gear Size'
    },

    properties: {
        controllerName: {
            default: '',
            visible: false,
            notify: function () {
                this.apply();
            }
        },
        targetNode: {
            default: null,
            type: cc.Node,
            visible: false
        },
        defaultWidth: {
            default: 0,
            visible: false
        },
        defaultHeight: {
            default: 0,
            visible: false
        },
        defaultScaleX: {
            default: 1,
            visible: false
        },
        defaultScaleY: {
            default: 1,
            visible: false
        },
        states: {
            default: [],
            visible: false,
            type: [UIControllerSizeState],
            notify: function () {
                this.apply();
            }
        }
    },

    onLoad: function () {
        this._lastAppliedPage = '';
        this._lastAppliedState = null;
        if (!this.targetNode) {
            this.targetNode = this.node;
        }
        if (this._isDefaultStateEmpty() && this.targetNode) {
            this._assignDefaultState(this._readNodeState(this.targetNode));
        }
        this.apply();
    },

    onEnable: function () {
        this.apply();
    },

    apply: function () {
        var rootController = this._getRootController();
        var targetNode = this.targetNode || this.node;
        if (!rootController || !targetNode || !this.controllerName) {
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
        var nextState = state ? this._cloneState(state) : this._getDefaultState();

        if (CC_EDITOR && currentPage && this._lastAppliedPage === currentPage) {
            var currentNodeState = this._readNodeState(targetNode);
            if (!this._isSameState(currentNodeState, this._lastAppliedState)) {
                if (state) {
                    state.width = currentNodeState.width;
                    state.height = currentNodeState.height;
                    state.scaleX = currentNodeState.scaleX;
                    state.scaleY = currentNodeState.scaleY;
                    nextState = this._cloneState(state);
                }
                else {
                    this._assignDefaultState(currentNodeState);
                    nextState = this._getDefaultState();
                }
            }
        }

        this._applyState(targetNode, nextState);
        this._lastAppliedPage = currentPage;
        this._lastAppliedState = this._cloneState(nextState);
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

    _readNodeState: function (node) {
        return {
            width: node ? node.width : 0,
            height: node ? node.height : 0,
            scaleX: node ? node.scaleX : 1,
            scaleY: node ? node.scaleY : 1
        };
    },

    _getDefaultState: function () {
        return {
            width: this.defaultWidth,
            height: this.defaultHeight,
            scaleX: this.defaultScaleX,
            scaleY: this.defaultScaleY
        };
    },

    _assignDefaultState: function (state) {
        var nextState = state || {};
        this.defaultWidth = typeof nextState.width === 'number' ? nextState.width : 0;
        this.defaultHeight = typeof nextState.height === 'number' ? nextState.height : 0;
        this.defaultScaleX = typeof nextState.scaleX === 'number' ? nextState.scaleX : 1;
        this.defaultScaleY = typeof nextState.scaleY === 'number' ? nextState.scaleY : 1;
    },

    _cloneState: function (state) {
        var source = state || {};
        return {
            width: typeof source.width === 'number' ? source.width : 0,
            height: typeof source.height === 'number' ? source.height : 0,
            scaleX: typeof source.scaleX === 'number' ? source.scaleX : 1,
            scaleY: typeof source.scaleY === 'number' ? source.scaleY : 1
        };
    },

    _isSameState: function (a, b) {
        if (!a || !b) {
            return false;
        }

        return a.width === b.width
            && a.height === b.height
            && a.scaleX === b.scaleX
            && a.scaleY === b.scaleY;
    },

    _applyState: function (node, state) {
        if (!node || !state) {
            return;
        }

        if (node.width !== state.width || node.height !== state.height) {
            node.setContentSize(state.width, state.height);
        }
        if (node.scaleX !== state.scaleX) {
            node.scaleX = state.scaleX;
        }
        if (node.scaleY !== state.scaleY) {
            node.scaleY = state.scaleY;
        }
    },

    _isDefaultStateEmpty: function () {
        return this.defaultWidth === 0
            && this.defaultHeight === 0
            && this.defaultScaleX === 1
            && this.defaultScaleY === 1;
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
