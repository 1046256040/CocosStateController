var UIControllerImageState = cc.Class({
    name: 'UIControllerImageState',
    properties: {
        page: '',
        spriteFrame: {
            default: null,
            type: cc.SpriteFrame
        }
    }
});

cc.Class({
    extends: cc.Component,

    editor: {
        executeInEditMode: true,
        menu: 'Custom/Fairy Gear Image'
    },

    properties: {
        controllerName: {
            default: '',
            visible: false,
            notify: function () {
                this.apply();
            }
        },
        targetSprite: {
            default: null,
            type: cc.Sprite,
            visible: false
        },
        defaultSpriteFrame: {
            default: null,
            type: cc.SpriteFrame,
            visible: false
        },
        states: {
            default: [],
            type: [UIControllerImageState],
            visible: false,
            notify: function () {
                this.apply();
            }
        }
    },

    onLoad: function () {
        this._lastAppliedPage = '';
        this._lastAppliedSpriteFrame = null;
        if (!this.targetSprite) {
            this.targetSprite = this.getComponent(cc.Sprite);
        }
        if (!this.defaultSpriteFrame && this.targetSprite) {
            this.defaultSpriteFrame = this.targetSprite.spriteFrame;
        }
        this.apply();
    },

    onEnable: function () {
        this.apply();
    },

    apply: function () {
        var rootController = this._getRootController();
        var targetSprite = this.targetSprite || this.getComponent(cc.Sprite);
        if (!rootController || !targetSprite || !this.controllerName) {
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
        var nextSpriteFrame = state ? state.spriteFrame : this.defaultSpriteFrame;

        if (CC_EDITOR && currentPage && this._lastAppliedPage === currentPage) {
            if (targetSprite.spriteFrame !== this._lastAppliedSpriteFrame) {
                if (state) {
                    state.spriteFrame = targetSprite.spriteFrame;
                    nextSpriteFrame = state.spriteFrame;
                }
                else {
                    this.defaultSpriteFrame = targetSprite.spriteFrame;
                    nextSpriteFrame = this.defaultSpriteFrame;
                }
            }
        }

        if (targetSprite.spriteFrame !== nextSpriteFrame) {
            targetSprite.spriteFrame = nextSpriteFrame || null;
        }
        this._lastAppliedPage = currentPage;
        this._lastAppliedSpriteFrame = nextSpriteFrame || null;
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
