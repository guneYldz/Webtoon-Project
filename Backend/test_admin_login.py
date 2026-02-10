import requests

def test_login():
    url = "http://localhost:8000/admin/login"
    
    # CASE 1: Empty password
    data = {"username": "admin", "password": ""}
    res = requests.post(url, data=data, allow_redirects=False)
    print(f"CASE 1 (Empty Pass): Status={res.status_code}, Location={res.headers.get('location')}")
    
    # CASE 2: Wrong password
    data = {"username": "admin", "password": "wrongpassword"}
    res = requests.post(url, data=data, allow_redirects=False)
    print(f"CASE 2 (Wrong Pass): Status={res.status_code}, Location={res.headers.get('location')}")
    
    # CASE 3: Correct password (if we knew it) - skipping
    
if __name__ == "__main__":
    test_login()
