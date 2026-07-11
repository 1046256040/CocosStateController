var UIControllerPositionState = cc.Class({
    name: 'UIControllerPositionState',
    properties: {
        page: '',
        position: {
            default: cc.v2(0, 0)
        }
    }
});

cc.Class({
    extends: cc.Component,

    editor: {
        executeInEditMode: true,
        menu: 'Custom/Fairy Gear Position'
    },

    properties: {
        controllerName: {
            default: '',
            notify: function () {
                this.apply();
            }
        },
        targetNode: {
            default: null,
            type: cc.Node
        },
        defaultPosition: {
            default: cc.v2(0, 0)
        },
        states: {
            default: [],
            type: [UIControllerPositionState],
            notify: function () {
                this.apply();
            }
        }
    },

    onLoad: function () {
        if (!this.targetNode) {
            this.targetNode = this.node;
        }
        if (this.defaultPosition.x === 0 && this.defaultPosition.y === 0 && this.targetNode) {
            this.defaultPosition = cc.v2(this.targetNode.x, this.targetNode.y);
        }
        this.apply();
    },

    onEnable: function () {
        this.apply();
    },

    apply: function () {
        var controller = this._getRootController();
        var targetNode = this.targetNode || this.node;
        if (!controller || !targetNode || !this.controllerName) {
            return;
        }

        var state = this._findState(controller);
        var position = state ? state.position : this.defaultPosition;
        targetNode.setPosition(position.x, position.y);
    },

    _findState: function (controller) {
        var currentId = controller.getCurrentPageId
            ? controller.getCurrentPageId(this.controllerName)
            : controller.getPageId(this.controllerName, controller.getCurrentPageName(this.controllerName));
        var currentName = controller.getCurrentPageName
            ? controller.getCurrentPageName(this.controllerName)
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
