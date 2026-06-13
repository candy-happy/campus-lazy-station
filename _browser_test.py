from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    
    errors = []
    page.on("console", lambda msg: errors.append(str(msg.type) + '|' + msg.text) if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda err: errors.append("PAGE_ERROR|" + err.message))
    
    page.goto("http://localhost:3000/app.html", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(3000)
    
    # Check login overlay
    login_overlay = page.query_selector("#loginOverlay")
    if login_overlay and login_overlay.is_visible():
        print("LOGIN overlay VISIBLE")
        captcha = page.query_selector("#captchaImg")
        if captcha:
            src = captcha.get_attribute("src")
            print("Captcha src:", src)
            bbox = captcha.bounding_box()
            print("Captcha bbox:", bbox)
            natural_width = page.evaluate("document.getElementById('captchaImg').naturalWidth")
            natural_height = page.evaluate("document.getElementById('captchaImg').naturalHeight")
            print("Captcha natural size:", natural_width, "x", natural_height)
        else:
            print("Captcha img MISSING")
        
        # Check all inputs
        sid = page.query_selector("#loginStudentId")
        pw = page.query_selector("#loginPassword")
        cap_input = page.query_selector("#loginCaptcha")
        btn = page.query_selector("#loginBtn")
        print("StudentId input:", sid is not None)
        print("Password input:", pw is not None)
        print("Captcha input:", cap_input is not None)
        print("Login btn:", btn is not None)
    else:
        print("Login overlay NOT visible")
    
    # Check errors
    print("--- Errors/Warnings:", len(errors), "---")
    for e in errors[:30]:
        print(e[:300])
    
    page.screenshot(path="C:/Users/19733/.qclaw/workspace/campus-lazy-station/_screenshot.png")
    print("Screenshot saved")
    
    browser.close()
