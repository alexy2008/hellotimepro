// 根窗口：Header + StackView 路由内容 + Footer。
// 路由：nav 用 replace，详情/登录用 push；守卫拦截 /create /me*。
// = React MainLayout/router + SwiftUI RootView。
import QtQuick
import QtQuick.Controls
import QtQuick.Window
import "components"
import "pages"

ApplicationWindow {
    id: win
    visible: true
    width: 1180
    height: 820
    minimumWidth: 900
    minimumHeight: 600
    title: "HelloTime Pro"
    color: Theme.colors.surface0

    // 当前路由（供 Header 高亮）——绑定到栈顶页面的 route 属性
    readonly property string currentRoute: stack.currentItem && stack.currentItem.route !== undefined ? stack.currentItem.route : "plaza"

    // 路由名 → 组件
    function componentFor(route) {
        switch (route) {
        case "plaza": return plazaC
        case "open": return openC
        case "about": return aboutC
        case "login": return loginC
        case "register": return registerC
        case "create": return createC
        case "detail": return detailC
        case "me-created": return meCreatedC
        case "me-favorites": return meFavoritesC
        case "me-profile": return meProfileC
        default: return notFoundC
        }
    }

    function needsAuth(route) {
        return route === "create" || route.indexOf("me-") === 0
    }

    // 顶层导航（替换当前页）
    function go(route, props) {
        if (needsAuth(route) && !Auth.canAccessProtected) {
            Auth.setPendingFrom(route)
            stack.replace(loginC)
            return
        }
        stack.replace(componentFor(route), props || {})
    }
    // 压栈（详情/登录入口，可返回）
    function push(route, props) {
        if (needsAuth(route) && !Auth.canAccessProtected) {
            Auth.setPendingFrom(route)
            stack.push(loginC)
            return
        }
        stack.push(componentFor(route), props || {})
    }
    function back() {
        if (stack.depth > 1) stack.pop()
        else stack.replace(plazaC)
    }

    // 登录/注册成功 → 跳到目标路由（pendingFrom）
    Connections {
        target: Auth
        function onLoginSucceeded(fromRoute) {
            stack.replace(componentFor(fromRoute && fromRoute !== "" ? fromRoute : "me-created"))
        }
    }

    Column {
        anchors.fill: parent
        AppHeader { width: parent.width }
        StackView {
            id: stack
            width: parent.width
            height: parent.height - win.headerH - win.footerH
            initialItem: plazaC
            // 无切换动画，贴近 SPA 即时切换
            replaceEnter: Transition {}
            replaceExit: Transition {}
            pushEnter: Transition {}
            pushExit: Transition {}
            popEnter: Transition {}
            popExit: Transition {}
        }
        AppFooter { width: parent.width }
    }

    property int headerH: 64
    property int footerH: 64

    // 页面组件
    Component { id: plazaC; PlazaPage {} }
    Component { id: openC; OpenPage {} }
    Component { id: aboutC; AboutPage {} }
    Component { id: loginC; LoginPage {} }
    Component { id: registerC; RegisterPage {} }
    Component { id: createC; CreatePage {} }
    Component { id: detailC; CapsuleDetailPage {} }
    Component { id: meCreatedC; MeCreatedPage {} }
    Component { id: meFavoritesC; MeFavoritesPage {} }
    Component { id: meProfileC; MeProfilePage {} }
    Component { id: notFoundC; NotFoundPage {} }
}
