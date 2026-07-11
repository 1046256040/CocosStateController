cc.Class({
    extends: cc.Component,

    editor: {
        executeInEditMode: true,
        menu: 'Custom/Fairy Gear Display'
    },

    properties: {
        controllerName: {
            default: '',
            notify: function () {
                this.apply();
            }
        },
        pages: {
            default: [],
            type: [cc.String],
            tooltip: '支持填写 pageName 或 pageId',
            notify: function () {
                this.apply();
            }
        },
        invert: {
            default: false,
            notify: function () {
                this.apply();
            }
        }
    },

    onLoad: function () {
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

        var visible = !this.pages.length || this._matchesPages(rootController);
        this.node.active = this.invert ? !visible : visible;
    },

    _matchesPages: function (rootController) {
        var activePage = rootController.getCurrentPageName
            ? rootController.getCurrentPageName(this.controllerName)
            : '';
        var activePageId = rootController.getCurrentPageId
            ? rootController.getCurrentPageId(this.controllerName)
            : rootController.getPageId(this.controllerName, activePage);

        for (var i = 0; i < this.pages.length; i++) {
            if (this.pages[i] === activePage || this.pages[i] === activePageId) {
                return true;
            }
        }

        return false;
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
