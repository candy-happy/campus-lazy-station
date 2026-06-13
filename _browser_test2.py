from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    
    errors = []
    page.on("console", lambda msg: errors.append(str(msg.type) + '|' + msg.text) if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda err: errors.append("PAGE_ERROR|" + err.message))
    
    # Pre-set a saved session in localStorage before loading
    page.goto("http://localhost:3000/app.html", wait_until="commit")
    page.evaluate("""() => {
        localStorage.setItem('lazy_session', JSON.stringify({
            role: 'user',
            student_id: '230725116',
            phone: '13645653760',
            name: 'candy',
            avatar: ''
        }));
        localStorage.setItem('lazy_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoidXNlciIsInN0dWRlbnRfaWQiOiIyMzA3MjUxMTYiLCJwaG9uZSI6IjEzNjQ1NjUzNzYwIiwiZXhwIjoxNzgxNDE0NTY3ODcyfQ.UfMJUqC2Q-3i_9xJEoHV0MqL-WDmQEDdxgDf4qb4dCA');
    }""")
    
    page.goto("http://localhost:3000/app.html", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(5000)
    
    # Check if login overlay is visible
    login_overlay = page.query_selector("#loginOverlay")
    if login_overlay:
        visible = login_overlay.is_visible()
        print("Login overlay:", "visible" if visible else "hidden")
    else:
        print("Login overlay: missing")
    
    # Check main app
    main_app = page.query_selector(".main-app")
    if main_app:
        print("Main app: present")
    else:
        print("Main app: missing")
    
    # Check if orders section has content
    orders = page.query_selector(".orders-list")
    if orders:
        inner = orders.inner_text()[:300]
        print("Orders content:", repr(inner[:200]))
    
    # Check wall posts
    wall = page.query_selector(".wall-feed")
    if wall:
        inner = wall.inner_text()[:300]
        print("Wall content:", repr(inner[:200]))
    
    print("--- Errors/Warnings:", len(errors), "---")
    for e in errors[:30]:
        print(e[:300])
    
    page.screenshot(path="C:/Users/19733/.qclaw/workspace/campus-lazy-station/_screenshot2.png")
    print("Screenshot saved")
    
    browser.close()
