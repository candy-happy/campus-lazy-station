from playwright.sync_api import sync_playwright
import re, base64, json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    
    errors = []
    page.on("console", lambda msg: errors.append(str(msg.type) + '|' + msg.text) if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda err: errors.append("PAGE_ERROR|" + err.message))
    
    # First, get a captcha by calling the API directly
    page.goto("http://localhost:3000/api/captcha?phone=230725116")
    captcha_svg = page.content()
    # Extract captcha digits from SVG (they're in <text> elements)
    text_match = re.findall(r'<text[^>]*>(\d)</text>', captcha_svg)
    captcha_code = ''.join(text_match[:4])
    print("Captcha digits:", captcha_code)
    
    # Now go to the login page
    page.goto("http://localhost:3000/app.html", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(2000)
    
    # Fill in login form
    page.fill("#loginStudentId", "230725116")
    page.fill("#loginPassword", "shoujihao")
    page.fill("#loginCaptcha", captcha_code)
    
    # Check agree terms checkbox
    page.check("#agreeTerms")
    
    # Click login button
    page.click("#loginBtn")
    page.wait_for_timeout(3000)
    
    # Check state after login
    login_overlay = page.query_selector("#loginOverlay")
    if login_overlay:
        visible = page.evaluate("document.getElementById('loginOverlay').style.display")
        print("Login overlay display:", visible)
    
    # Check if main app is showing
    main_app = page.query_selector(".main-app")
    if main_app:
        print("Main app: present")
    else:
        print("Main app: missing")
    
    # Check for orders
    orders = page.query_selector(".order-item")
    if orders:
        print("Order items found:", len(page.query_selector_all(".order-item")))
    
    # Check for wall posts
    wall_posts = page.query_selector(".wall-post")
    if wall_posts:
        print("Wall posts found:", len(page.query_selector_all(".wall-post")))
    
    print("--- Errors/Warnings:", len(errors), "---")
    for e in errors[:30]:
        print(e[:300])
    
    page.screenshot(path="C:/Users/19733/.qclaw/workspace/campus-lazy-station/_screenshot_loggedin.png")
    print("Screenshot saved")
    
    browser.close()
