import argparse
import json
import sys
from datetime import datetime, timedelta
import requests

def jprint(obj):
    try:
        return json.dumps(obj, ensure_ascii=False, indent=2)
    except Exception:
        return str(obj)

def get_args():
    now = datetime.utcnow()
    y = now.year
    m1 = now.month
    # חודש קודם
    pm = (now.replace(day=1) - timedelta(days=1)).month
    parser = argparse.ArgumentParser(
        description="Sample tester for Cost Manager RESTful Web Services"
    )
    parser.add_argument("--base", default="http://localhost:3000", help="Base URL, e.g., https://your-service.onrender.com")
    parser.add_argument("--outfile", default="result.txt", help="Output file to save the log")
    parser.add_argument("--user", type=int, default=123123, help="Test user id")
    parser.add_argument("--year", type=int, default=y, help="Report year")
    parser.add_argument("--month1", type=int, default=m1, help="First report month (usually current)")
    parser.add_argument("--month2", type=int, default=pm, help="Second report month (usually previous)")
    return parser.parse_args()

def log(fh, *parts):
    line = " ".join(str(p) for p in parts)
    print(line)
    fh.write(line + "\n")

def ensure_user(base, user_id, fh):
    """יוצר משתמש בדיקה אם לא קיים. מקבל 201 או 409 (כבר קיים)."""
    url = f"{base}/api/add"
    payload = {
        "id": user_id,
        "first_name": "Test",
        "last_name": "User",
        "birthday": "1999-09-09"
    }
    log(fh, "\n== ensuring test user ==", f"user:{user_id}", "POST", url)
    try:
        r = requests.post(url, json=payload, timeout=20)
        log(fh, "status:", r.status_code)
        log(fh, "text:", r.text)
        if r.status_code not in (201, 409):
            log(fh, "WARN: unexpected status when creating user (expected 201/409)")
        return r
    except Exception as e:
        log(fh, "problem:", e)
        return None

def test_about(base, fh):
    url = f"{base}/api/about"
    log(fh, "\n== testing getting the about ==", "GET", url)
    try:
        r = requests.get(url, timeout=20)
        log(fh, "data.status_code=", r.status_code)
        log(fh, "data.text=", r.text)
        try:
            js = r.json()
            log(fh, "json=", jprint(js))
        except Exception:
            pass
        return r
    except Exception as e:
        log(fh, "problem", e)
        return None

def test_report(base, user_id, year, month, fh, label):
    url = f"{base}/api/report?id={user_id}&year={year}&month={month}"
    log(fh, f"\n== testing getting the report - {label} ==", "GET", url)
    try:
        r = requests.get(url, timeout=30)
        log(fh, "data.status_code=", r.status_code)
        log(fh, "data.text=", r.text)
        try:
            js = r.json()
            log(fh, "json=", jprint(js))
        except Exception:
            pass
        return r
    except Exception as e:
        log(fh, "problem", e)
        return None

def test_add_cost(base, user_id, fh):
    url = f"{base}/api/add"
    payload = {
        "userid": user_id,
        "description": "milk",
        "category": "food",
        "sum": 8
        # לא שולחים date כדי לא להיתקע על 'עבר' – השרת יקבע היום
    }
    log(fh, "\n== testing adding cost item ==", "POST", url)
    try:
        r = requests.post(url, json=payload, timeout=20)
        log(fh, "data.status_code=", r.status_code)
        log(fh, "data.text=", r.text)
        try:
            js = r.json()
            log(fh, "json=", jprint(js))
        except Exception:
            pass
        return r
    except Exception as e:
        log(fh, "problem", e)
        return None

def main():
    args = get_args()
    with open(args.outfile, "w", encoding="utf-8") as fh:
        log(fh, "Base:", args.base)
        log(fh, "Output file:", args.outfile)
        log(fh, "User:", args.user, "Year:", args.year, "Month1:", args.month1, "Month2:", args.month2)

        # 1) /api/about
        r_about = test_about(args.base, fh)

        # 2) דו״ח ראשון
        r_rep1 = test_report(args.base, args.user, args.year, args.month1, fh, "1")

        # 3) וידוא משתמש קיים
        ensure_user(args.base, args.user, fh)

        # 4) הוספת הוצאה
        r_add = test_add_cost(args.base, args.user, fh)

        # 5) דו״ח שני (לרוב חודש אחר/עבר)
        r_rep2 = test_report(args.base, args.user, args.year, args.month2, fh, "2")

        # סיכום קצר
        log(fh, "\n== SUMMARY ==")
        def ok(r): return (r is not None and isinstance(r.status_code, int) and r.status_code < 500)
        log(fh, "about OK:", ok(r_about))
        log(fh, "report1 OK:", ok(r_rep1))
        log(fh, "add cost OK:", ok(r_add))
        log(fh, "report2 OK:", ok(r_rep2))

if __name__ == "__main__":
    main()
