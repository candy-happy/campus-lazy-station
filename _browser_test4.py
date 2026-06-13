from playwright.sync_api import sync_playwright
import re

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    
    errors = []
    page.on("console", lambda msg: errors.append(str(msg.type) + '|' + msg.text) if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda err: errors.append("PAGE_ERROR|" + err.message))
    
    # Go to login page
    page.goto("http://localhost:3000/app.html", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(2000)  # Wait for captcha refresh
    
    # Read captcha from the img element
    captcha_img = page.query_selector("#captchaImg")
    captcha_src = captcha_img.get_attribute("src")
    print("Captcha src:", captcha_src)
    
    # Navigate directly to the captcha URL to read its content
    page.goto("http://localhost:3000" + captcha_src)
    captcha_svg = page.content()
    text_match = re.findall(r'<text[^>]*>(\d)</text>', captcha_svg)
    captcha_code = ''.join(text_match[:4])
    print("Captcha digits:", captcha_code)
    
    # Go back to login page
    page.goto("http://localhost:3000/app.html", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)
    
    # Fill in login form
    page.fill("#loginStudentId", "230725116")
    page.fill("#loginPassword", "shoujihao")
    page.fill("#loginCaptcha", captcha_code)
    page.check("#agreeTerms")
    page.click("#loginBtn")
    page.wait_for_timeout(3000)
    
    # Check state
    login_overlay = page.query_selector("#loginOverlay")
    print("Login overlay visible:", "none" if login_overlay and page.evaluate("document.getElementById('loginOverlay').style.display") == "none" else "visible")
    
    main_app = page.query_selector(".main-app")
    print("Main app present:", main_app is not None)
    
    orders = page.query_selector_all(".order-item")
    print("Order items:", len(orders))
    
    notif_badge = page.query_selector(".msg-badge")
    print("Msg badge present:", notif_badge is not None)
    
    # Check localStorage for token
    token = page.evaluate("localStorage.getItem('lazy_token')")
    print("Token saved:", "yes" if token else "no")
    
    print("--- Errors/Warnings:", len(errors), "---")
    for e in errors[:20]:
        print(e[:300])
    
    page.screenshot(path="C:/Users/19733/.qclaw/workspace/campus-lazy-station/_loggedin.png")
    print("Screenshot saved")
    
    browser.close()
