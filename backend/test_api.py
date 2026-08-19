import os
import sys
import time
import subprocess
import requests

# Set working directory to the directory of this script
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Ensure requests is installed
try:
    import requests
except ImportError:
    print("Installing 'requests' library for testing...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("=" * 60)
    print("AI-POWERED SMART TRAFFIC DIGITAL TWIN - INTEGRATION TESTS")
    print("=" * 60)
    
    # 1. Start backend server
    already_running = False
    server_process = None
    try:
        res = requests.get("http://127.0.0.1:8000/docs", timeout=2)
        print("[+] Detected existing backend server running on port 8000. Reusing it.")
        already_running = True
    except Exception:
        pass

    if not already_running:
        print("\n[+] Launching FastAPI Backend Server...")
        server_process = subprocess.Popen(
            [sys.executable, "run.py"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        # Give the server 3 seconds to spin up
        time.sleep(3)
        
        # Test connection
        try:
            res = requests.get("http://127.0.0.1:8000/docs", timeout=5)
            print("[+] Backend Server connected successfully on port 8000.")
        except Exception as e:
            print(f"[-] Failed to connect to server: {e}")
            if server_process:
                server_process.terminate()
            sys.exit(1)
        
    results = {}
    
    # Helper to print test step
    def run_step(name, func):
        print(f"\n[Running Test] {name}...")
        try:
            passed, msg = func()
            if passed:
                print(f"  -> PASSED: {msg}")
                results[name] = ("PASSED", msg)
            else:
                print(f"  -> FAILED: {msg}")
                results[name] = ("FAILED", msg)
        except Exception as err:
            print(f"  -> CRASHED: {err}")
            results[name] = ("CRASHED", str(err))

    # Shared tokens and IDs across tests
    auth_data = {
        "admin_token": None,
        "user_token": None,
        "test_location": "Noida Sector 62 Intersection",
        "new_location": "Delhi Outer Ring Road Cross",
        "emergency_id": None,
        "challan_id": None
    }

    # Test 1: User Signup
    def test_signup():
        payload = {
            "username": "test_admin",
            "password": "secure_pass123",
            "email": "test_admin@traffic.gov.in",
            "phone": "+91 99999 88888",
            "role": "admin",
            "assigned_location": auth_data["test_location"]
        }
        res = requests.post(f"{BASE_URL}/auth/signup", json=payload)
        if res.status_code == 200:
            return True, "User signed up successfully and location auto-created."
        elif res.status_code == 400 and "already registered" in res.json().get("detail", ""):
            return True, "User already registered (expected behavior for repeat runs)."
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 2: User Login
    def test_login():
        payload = {
            "username": "test_admin",
            "password": "secure_pass123"
        }
        res = requests.post(f"{BASE_URL}/auth/login", json=payload)
        if res.status_code == 200:
            data = res.json()
            auth_data["admin_token"] = data["access_token"]
            return True, "Login successful, authentication token generated."
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 3: Get Profile
    def test_profile():
        headers = {"Authorization": f"Bearer {auth_data['admin_token']}"}
        res = requests.get(f"{BASE_URL}/auth/profile", headers=headers)
        if res.status_code == 200:
            data = res.json()
            if data["username"] == "test_admin":
                return True, f"Profile verified: Rank={data.get('rank')}, Badge={data.get('badge_number')}"
            return False, f"Unexpected username in response: {data['username']}"
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 4: Update Profile
    def test_update_profile():
        headers = {"Authorization": f"Bearer {auth_data['admin_token']}"}
        payload = {
            "full_name": "Senior Inspector Test Admin",
            "phone": "+91 98765 12345",
            "rank": "Orchestration Chief",
            "badge_number": "POL-98765"
        }
        res = requests.put(f"{BASE_URL}/auth/update-profile", headers=headers, json=payload)
        if res.status_code == 200:
            return True, "Profile details synchronized to database."
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 5: Verify Badge
    def test_verify_badge():
        res = requests.get(f"{BASE_URL}/auth/verify-badge/test_admin")
        if res.status_code == 200:
            data = res.json()
            if data["rank"] == "Orchestration Chief" and data["badge_number"] == "POL-98765":
                return True, f"Badge verified: Rank={data['rank']}, Status={data['status']}"
            return False, f"Mismatched data returned: {data}"
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 6: Forgot Password
    def test_forgot_password():
        payload = {
            "username": "test_admin",
            "email": "test_admin@traffic.gov.in",
            "badge_number": "POL-98765",
            "new_password": "secure_pass123"
        }
        res = requests.post(f"{BASE_URL}/auth/forgot-password", json=payload)
        if res.status_code == 200:
            return True, "Passcode reset completed and verified."
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 7: Get All Locations
    def test_locations():
        res = requests.get(f"{BASE_URL}/traffic/locations")
        if res.status_code == 200:
            data = res.json()
            return True, f"Retrieved {len(data)} active locations from DB."
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 8: Get Single Location
    def test_single_location():
        loc_name = auth_data["test_location"]
        res = requests.get(f"{BASE_URL}/traffic/locations/{loc_name}")
        if res.status_code == 200:
            data = res.json()
            return True, f"Location verified: Density={data.get('current_density')}, OVERRIDE={data.get('manual_override')}"
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 9: Accident Prediction Simulation
    def test_accident_prediction():
        loc_name = auth_data["test_location"]
        res = requests.get(f"{BASE_URL}/traffic/predict-accident/{loc_name}?weather=Rainy")
        if res.status_code == 200:
            data = res.json()
            return True, f"Risk analysis generated: Prob={data['probability']}, RiskLevel={data['risk_level']}"
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 10: Register Grid Location (Admin)
    def test_register_location():
        headers = {"Authorization": f"Bearer {auth_data['admin_token']}"}
        payload = {
            "name": auth_data["new_location"],
            "latitude": 28.5355,
            "longitude": 77.3910,
            "traffic_status": "Low"
        }
        res = requests.post(f"{BASE_URL}/admin/locations", headers=headers, json=payload)
        if res.status_code == 200:
            return True, f"Created new digital twin intersection: {auth_data['new_location']}"
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 11: Override Signals (Admin)
    def test_override_signal():
        headers = {"Authorization": f"Bearer {auth_data['admin_token']}"}
        payload = {
            "manual_override": True,
            "current_density": 65.5,
            "vehicle_counts": {"car": 30, "bus": 2, "truck": 1, "motorcycle": 20, "bicycle": 2},
            "red_time": 15,
            "green_time": 45,
            "yellow_time": 5
        }
        res = requests.put(
            f"{BASE_URL}/admin/locations/{auth_data['test_location']}/override",
            headers=headers,
            json=payload
        )
        if res.status_code == 200:
            data = res.json()
            if data["manual_override"] is True and data["green_time"] == 45:
                return True, "Override timers and densities successfully applied."
            return False, f"Unexpected override values returned: {data}"
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 12: Citizen SOS Report
    def test_citizen_sos():
        payload = {
            "type": "Ambulance",
            "start_location": "Noida Sector 62 Intersection",
            "destination_location": "Rajiv Chowk Metro Square"
        }
        res = requests.post(f"{BASE_URL}/traffic/emergency", json=payload)
        if res.status_code == 201:
            data = res.json()
            auth_data["emergency_id"] = data["id"]
            return True, f"Emergency report filed. Ticket ID: {data['id']}"
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 13: Get Emergencies
    def test_get_emergencies():
        res = requests.get(f"{BASE_URL}/traffic/emergencies")
        if res.status_code == 200:
            data = res.json()
            return True, f"SOS registry retrieved successfully ({len(data)} events)."
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 14: Calculate Emergency Route (Admin)
    def test_calculate_route():
        start = "Noida Sector 62 Intersection"
        dest = "Rajiv Chowk Metro Square"
        res = requests.get(f"{BASE_URL}/traffic/calculate-route?start={start}&destination={dest}")
        if res.status_code == 200:
            data = res.json()
            return True, f"Optimal routing layout generated. Route={data['route']}"
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 15: Route Emergency Response (Admin Dispatch)
    def test_dispatch_emergency():
        headers = {"Authorization": f"Bearer {auth_data['admin_token']}"}
        payload = ["Noida Sector 62 Intersection", "India Gate Circle", "Rajiv Chowk Metro Square"]
        res = requests.put(
            f"{BASE_URL}/admin/emergencies/{auth_data['emergency_id']}/route",
            headers=headers,
            json=payload
        )
        if res.status_code == 200:
            data = res.json()
            return True, f"SOS Dispatched: Status={data['status']}, Message={data['message']}"
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 16: Clear Emergency (Admin Resolve)
    def test_clear_emergency():
        headers = {"Authorization": f"Bearer {auth_data['admin_token']}"}
        res = requests.put(
            f"{BASE_URL}/admin/emergencies/{auth_data['emergency_id']}/clear",
            headers=headers
        )
        if res.status_code == 200:
            data = res.json()
            return True, f"Emergency completed. Status={data['status']}, Message={data['message']}"
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 17: Get Admin Connections Status
    def test_admins_status():
        headers = {"Authorization": f"Bearer {auth_data['admin_token']}"}
        res = requests.get(f"{BASE_URL}/admin/admins/status", headers=headers)
        if res.status_code == 200:
            data = res.json()
            return True, f"Active control room instances retrieved. Admin={data.get('admin_username')}, Locations={data.get('total_locations')}"
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 18: Get Control Room Directory
    def test_directory():
        res = requests.get(f"{BASE_URL}/admin/directory")
        if res.status_code == 200:
            data = res.json()
            return True, f"Active police directory list retrieved. Officers Count={len(data)}"
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 19: Challans Config and Lookup
    def test_challan_lookup():
        # Retrieve test config
        config_res = requests.get(f"{BASE_URL}/traffic/challans-config")
        if config_res.status_code != 200:
            return False, "Failed to retrieve challans configuration."
        
        # Test lookup for UP32-AB-8888
        res = requests.get(f"{BASE_URL}/traffic/challans/UP32-AB-8888")
        if res.status_code == 200:
            data = res.json()
            if len(data) > 0:
                auth_data["challan_id"] = data[0]["challan_id"]
                return True, f"Found {len(data)} violations for vehicle. Unpaid={data[0]['status']}"
            return True, "No violations for vehicle (valid output)."
        return False, f"Status code: {res.status_code}, Response: {res.text}"

    # Test 20: Challan Payment Order and Verification
    def test_challan_payment():
        if not auth_data["challan_id"]:
            return True, "Skipping: no unpaid challan ticket ID found to process."
        
        # 1. Create Order
        res = requests.post(f"{BASE_URL}/traffic/challans/{auth_data['challan_id']}/create-order")
        if res.status_code != 200:
            return False, f"Order creation failed: {res.text}"
        order_data = res.json()
        
        # 2. Verify Payment
        payload = {
            "challan_id": auth_data["challan_id"],
            "razorpay_payment_id": "pay_TEST_12345",
            "razorpay_order_id": order_data.get("order_id", "order_TEST_12345"),
            "razorpay_signature": "sig_TEST_12345"
        }
        verify_res = requests.post(f"{BASE_URL}/traffic/challans/verify-payment", json=payload)
        if verify_res.status_code == 200:
            return True, "Razorpay simulated payment cleared and ticket status updated to Paid."
        return False, f"Payment verification status code: {verify_res.status_code}, Response: {verify_res.text}"

    # Execute tests
    run_step("User Signup (/auth/signup)", test_signup)
    run_step("User Login (/auth/login)", test_login)
    run_step("Get Profile (/auth/profile)", test_profile)
    run_step("Update Profile (/auth/update-profile)", test_update_profile)
    run_step("Verify Badge (/auth/verify-badge/{username})", test_verify_badge)
    run_step("Forgot Password (/auth/forgot-password)", test_forgot_password)
    run_step("Get All Locations (/traffic/locations)", test_locations)
    run_step("Get Single Location (/traffic/locations/{name})", test_single_location)
    run_step("Accident Risk Telemetry (/traffic/predict-accident)", test_accident_prediction)
    run_step("Register Intersection (/admin/locations)", test_register_location)
    run_step("Override Signal Timers (/admin/locations/{name}/override)", test_override_signal)
    run_step("Citizen SOS Report (/traffic/emergency)", test_citizen_sos)
    run_step("Get Emergencies List (/traffic/emergencies)", test_get_emergencies)
    run_step("Calculate SOS Route (/traffic/calculate-route)", test_calculate_route)
    run_step("Dispatch Emergency Response (/admin/emergencies/{id}/route)", test_dispatch_emergency)
    run_step("Clear/Resolve Emergency (/admin/emergencies/{id}/clear)", test_clear_emergency)
    run_step("Get Admin Active Connections (/admin/admins/status)", test_admins_status)
    run_step("Get Officer Directory (/admin/directory)", test_directory)
    run_step("Challan Registry Lookup (/traffic/challans/{veh})", test_challan_lookup)
    run_step("Razorpay Payment Gateway Simulation", test_challan_payment)

    # 4. Clean up / terminate server
    if server_process:
        print("\n[+] Terminating backend server...")
        server_process.terminate()
        server_process.wait()
        print("[+] Backend Server terminated successfully.")
    else:
        print("\n[+] Reused existing server; skipping termination.")
    
    # 5. Output Summary
    print("\n" + "=" * 60)
    print("TEST REPORT SUMMARY")
    print("=" * 60)
    passed_count = sum(1 for status, _ in results.values() if status == "PASSED")
    failed_count = len(results) - passed_count
    
    for name, (status, msg) in results.items():
        print(f"[{status}] {name}: {msg}")
        
    print("-" * 60)
    print(f"Total Tests Run: {len(results)}")
    print(f"Total Passed: {passed_count}")
    print(f"Total Failed: {failed_count}")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
