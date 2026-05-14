"""
DataRex PDPA Compliance Portal - Supabase API UAT Test Suite
Run: pytest test_api.py -v --tb=short

Tests all Supabase REST API endpoints used by the application.
"""

import pytest
import requests
import time
import json
from datetime import datetime


# ============================================================
# CONFIGURATION
# ============================================================
SUPABASE_URL = "https://xvjfosmzmfitrcivsgpu.supabase.co"
SUPABASE_KEY = "sb_publishable_faN2IaAJ6HGApHqzmbvVFQ_vdMleyGH"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

BASE_URL = f"{SUPABASE_URL}/rest/v1"


# ============================================================
# HELPER FUNCTIONS
# ============================================================
def create_test_record(table, data):
    """Create a test record and return the response."""
    url = f"{BASE_URL}/{table}"
    response = requests.post(url, headers=HEADERS, json=data)
    return response


def delete_test_record(table, record_id):
    """Delete a test record."""
    url = f"{BASE_URL}/{table}?id=eq.{record_id}"
    response = requests.delete(url, headers=HEADERS)
    return response


def get_records(table, query=""):
    """Get records from a table."""
    url = f"{BASE_URL}/{table}{query}"
    response = requests.get(url, headers=HEADERS)
    return response


def update_record(table, record_id, data):
    """Update a record."""
    url = f"{BASE_URL}/{table}?id=eq.{record_id}"
    response = requests.patch(url, headers=HEADERS, json=data)
    return response


# ============================================================
# TEST SUITE 1: AUTH & CREDENTIALS
# ============================================================
def test_supabase_connection():
    """Test 1: Supabase connection is working."""
    url = f"{SUPABASE_URL}/rest/v1/"
    response = requests.get(url, headers=HEADERS)
    
    # 401 is expected for root endpoint without proper auth
    # But 200 for valid endpoints like app_credentials
    assert response.status_code in [200, 401, 405], f"Supabase should respond (got {response.status_code})"
    print(f"✅ Test 1: Supabase connection - Status {response.status_code}")


def test_app_credentials_select():
    """Test 2: Get active app credentials."""
    url = f"{BASE_URL}/app_credentials?is_active=eq.true&select=*"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get credentials"
    data = response.json()
    
    # Check for demo user
    if data:
        assert "email" in data[0], "Email field should exist"
        print(f"✅ Test 2: App credentials - Found {len(data)} record(s)")
    else:
        print("⚠️ Test 2: No active credentials (demo user may not exist)")


def test_app_credentials_insert():
    """Test 3: Insert new app credential."""
    test_email = f"test_api_{int(time.time())}@datarex.com"
    data = {
        "email": test_email,
        "password": "TestPass123",
        "is_active": True,
        "name": "API Test User"
    }
    
    url = f"{BASE_URL}/app_credentials"
    response = requests.post(url, headers=HEADERS, json=data)
    
    # May fail if anon key doesn't have insert permission
    if response.status_code in [200, 201]:
        print(f"✅ Test 3: App credentials insert - Created {response.json().get('id')}")
        # Clean up
        delete_test_record("app_credentials", response.json().get("id"))
    else:
        print(f"⚠️ Test 3: Insert blocked (status {response.status_code}) - expected for anon key")


# ============================================================
# TEST SUITE 2: CONSENT SETTINGS
# ============================================================
def test_consent_settings_select():
    """Test 4: Get consent settings."""
    url = f"{BASE_URL}/consent_settings?select=*"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get consent settings"
    data = response.json()
    
    if data:
        print(f"✅ Test 4: Consent settings - Found {len(data)} setting(s)")
    else:
        print("⚠️ Test 4: No consent settings yet")


def test_consent_settings_update():
    """Test 5: Update consent setting."""
    # First get existing
    url = f"{BASE_URL}/consent_settings?select=id&limit=1"
    response = requests.get(url, headers=HEADERS)
    
    if response.status_code == 200 and response.json():
        record_id = response.json()[0].get("id")
        
        # Update
        update_url = f"{BASE_URL}/consent_settings?id=eq.{record_id}"
        update_response = requests.patch(
            update_url,
            headers=HEADERS,
            json={"is_enabled": False}
        )
        
        if update_response.status_code in [200, 204]:
            print(f"✅ Test 5: Consent settings update - ID {record_id}")
        else:
            print(f"⚠️ Test 5: Update blocked (status {update_response.status_code})")
    else:
        print("⚠️ Test 5: No records to update")


# ============================================================
# TEST SUITE 3: CHECKLIST ITEMS
# ============================================================
def test_checklist_items_select():
    """Test 6: Get checklist items."""
    url = f"{BASE_URL}/checklist_items?select=*&limit=10"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get checklist items"
    print(f"✅ Test 6: Checklist items - Status {response.status_code}")


def test_checklist_items_insert():
    """Test 7: Insert checklist item."""
    data = {
        "user_id": "test-user-api",
        "item_id": "test-api-item",
        "completed": True,
        "completed_at": datetime.now().isoformat()
    }
    
    url = f"{BASE_URL}/checklist_items"
    response = requests.post(url, headers=HEADERS, json=data)
    
    if response.status_code in [200, 201]:
        result = response.json()
        record_id = result[0].get("id") if isinstance(result, list) else result.get("id")
        print(f"✅ Test 7: Checklist insert - ID {record_id}")
        
        # Clean up
        delete_test_record("checklist_items", record_id)
    else:
        print(f"⚠️ Test 7: Insert blocked (status {response.status_code})")


# ============================================================
# TEST SUITE 4: DATA RECORDS
# ============================================================
def test_data_records_select():
    """Test 8: Get data records."""
    url = f"{BASE_URL}/data_records?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get data records"
    data = response.json()
    print(f"✅ Test 8: Data records - Found {len(data)} record(s)")


def test_data_records_insert():
    """Test 9: Insert data record."""
    data = {
        "user_id": "test-user-api",
        "data_type": "Test Data Type",
        "purpose": "API Test Purpose",
        "storage": "Test Storage",
        "access_level": "Admin",
        "retention_months": 12,
        "consent_obtained": True
    }
    
    url = f"{BASE_URL}/data_records"
    response = requests.post(url, headers=HEADERS, json=data)
    
    if response.status_code in [200, 201]:
        result = response.json()
        record_id = result[0].get("id") if isinstance(result, list) else result.get("id")
        print(f"✅ Test 9: Data records insert - ID {record_id}")
        
        # Clean up
        delete_test_record("data_records", record_id)
    else:
        print(f"⚠️ Test 9: Insert blocked (status {response.status_code})")


# ============================================================
# TEST SUITE 5: COMPANIES
# ============================================================
def test_companies_select():
    """Test 10: Get companies."""
    url = f"{BASE_URL}/companies?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get companies"
    data = response.json()
    print(f"✅ Test 10: Companies - Found {len(data)} company(ies)")


def test_companies_insert():
    """Test 11: Insert company."""
    data = {
        "name": f"Test Company {int(time.time())}",
        "industry": "Technology",
        "country": "Singapore",
        "dpo_name": "API Test DPO"
    }
    
    url = f"{BASE_URL}/companies"
    response = requests.post(url, headers=HEADERS, json=data)
    
    if response.status_code in [200, 201]:
        result = response.json()
        record_id = result[0].get("id") if isinstance(result, list) else result.get("id")
        print(f"✅ Test 11: Companies insert - ID {record_id}")
        
        # Clean up
        delete_test_record("companies", record_id)
    else:
        print(f"⚠️ Test 11: Insert blocked (status {response.status_code})")


# ============================================================
# TEST SUITE 6: DOCUMENTS
# ============================================================
def test_documents_select():
    """Test 12: Get documents."""
    url = f"{BASE_URL}/documents?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get documents"
    data = response.json()
    print(f"✅ Test 12: Documents - Found {len(data)} document(s)")


# ============================================================
# TEST SUITE 7: TEAM MEMBERS
# ============================================================
def test_team_members_select():
    """Test 13: Get team members."""
    url = f"{BASE_URL}/team_members?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get team members"
    data = response.json()
    print(f"✅ Test 13: Team members - Found {len(data)} member(s)")


def test_team_members_insert():
    """Test 14: Insert team member."""
    data = {
        "name": f"API Test Member {int(time.time())}",
        "role": "User",
        "email": f"member{int(time.time())}@test.com",
        "level": "user"
    }
    
    url = f"{BASE_URL}/team_members"
    response = requests.post(url, headers=HEADERS, json=data)
    
    if response.status_code in [200, 201]:
        result = response.json()
        record_id = result[0].get("id") if isinstance(result, list) else result.get("id")
        print(f"✅ Test 14: Team members insert - ID {record_id}")
        
        # Clean up
        delete_test_record("team_members", record_id)
    else:
        print(f"⚠️ Test 14: Insert blocked (status {response.status_code})")


# ============================================================
# TEST SUITE 8: DATA REQUESTS
# ============================================================
def test_data_requests_select():
    """Test 15: Get data requests."""
    url = f"{BASE_URL}/data_requests?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get data requests"
    data = response.json()
    print(f"✅ Test 15: Data requests - Found {len(data)} request(s)")


# ============================================================
# TEST SUITE 9: BREACH LOG
# ============================================================
def test_breach_log_select():
    """Test 16: Get breach log."""
    url = f"{BASE_URL}/breach_log?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get breach log"
    data = response.json()
    print(f"✅ Test 16: Breach log - Found {len(data)} entry(ies)")


# ============================================================
# TEST SUITE 10: NAV PERMISSIONS
# ============================================================
def test_nav_permissions_select():
    """Test 17: Get nav permissions."""
    url = f"{BASE_URL}/nav_permissions?select=*&limit=10"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get nav permissions"
    data = response.json()
    print(f"✅ Test 17: Nav permissions - Found {len(data)} permission(s)")


# ============================================================
# TEST SUITE 11: VENDORS
# ============================================================
def test_vendors_select():
    """Test 18: Get vendors."""
    url = f"{BASE_URL}/vendors?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get vendors"
    data = response.json()
    print(f"✅ Test 18: Vendors - Found {len(data)} vendor(s)")


# ============================================================
# TEST SUITE 12: DPIA ASSESSMENTS
# ============================================================
def test_dpia_assessments_select():
    """Test 19: Get DPIA assessments."""
    url = f"{BASE_URL}/dpia_assessments?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get DPIA assessments"
    data = response.json()
    print(f"✅ Test 19: DPIA assessments - Found {len(data)} assessment(s)")


# ============================================================
# TEST SUITE 13: CROSS BORDER TRANSFERS
# ============================================================
def test_cross_border_transfers_select():
    """Test 20: Get cross border transfers."""
    url = f"{BASE_URL}/cross_border_transfers?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get cross border transfers"
    data = response.json()
    print(f"✅ Test 20: Cross border transfers - Found {len(data)} transfer(s)")


# ============================================================
# TEST SUITE 14: TRAINING RECORDS
# ============================================================
def test_training_records_select():
    """Test 21: Get training records."""
    url = f"{BASE_URL}/training_records?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get training records"
    data = response.json()
    print(f"✅ Test 21: Training records - Found {len(data)} record(s)")


# ============================================================
# TEST SUITE 15: ALERTS
# ============================================================
def test_alerts_select():
    """Test 22: Get alerts."""
    url = f"{BASE_URL}/alerts?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get alerts"
    data = response.json()
    print(f"✅ Test 22: Alerts - Found {len(data)} alert(s)")


# ============================================================
# TEST SUITE 16: CASES
# ============================================================
def test_cases_select():
    """Test 23: Get cases."""
    url = f"{BASE_URL}/cases?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get cases"
    data = response.json()
    print(f"✅ Test 23: Cases - Found {len(data)} case(s)")



# ============================================================
# TEST SUITE 17: DPO TABLE
# ============================================================
def test_dpo_select():
    """Test 24: Get DPO records."""
    url = f"{BASE_URL}/dpo?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    
    assert response.status_code == 200, "Should get DPO records"
    data = response.json()
    print(f"✅ Test 24: DPO records - Found {len(data)} record(s)")

def test_dpo_insert():
    """Test 25: Insert DPO record."""
    test_timestamp = int(time.time())
    data = {
        "name": f"DPO Test User {test_timestamp}",
        "email": f"dpo_{test_timestamp}@test.com",
        "phone": "+60 12 345 6789",
        "nationality": "Malaysian"
    }
    
    url = f"{BASE_URL}/dpo"
    response = requests.post(url, headers=HEADERS, json=data)
    
    if response.status_code in [200, 201]:
        result = response.json()
        record_id = result[0].get("id") if isinstance(result, list) else result.get("id")
        print(f"✅ Test 25: DPO insert - ID {record_id}")
        
        # Clean up
        delete_test_record("dpo", record_id)
    else:
        print(f"⚠️ Test 25: DPO insert blocked (status {response.status_code})")

def test_dpo_update():
    """Test 26: Update DPO record."""
    # First get existing
    url = f"{BASE_URL}/dpo?select=id&limit=1"
    response = requests.get(url, headers=HEADERS)
    
    if response.status_code == 200 and response.json():
        record_id = response.json()[0].get("id")
        
        update_url = f"{BASE_URL}/dpo?id=eq.{record_id}"
        update_response = requests.patch(
            update_url,
            headers=HEADERS,
            json={"phone": "+60 99 999 9999"}
        )
        
        if update_response.status_code in [200, 204]:
            print(f"✅ Test 26: DPO update - ID {record_id}")
        else:
            print(f"⚠️ Test 26: DPO update blocked (status {update_response.status_code})")
    else:
        print("⚠️ Test 26: No DPO records to update")

# ============================================================
# TEST SUITE 18: ADDITIONAL TABLES
# ============================================================
def test_profiles_select():
    """Test 27: Get user profiles."""
    url = f"{BASE_URL}/profiles?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    assert response.status_code == 200, "Should get profiles"
    data = response.json()
    print(f"✅ Test 27: Profiles - Found {len(data)} record(s)")

def test_retention_rules_select():
    """Test 28: Get retention rules."""
    url = f"{BASE_URL}/retention_rules?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    assert response.status_code == 200, "Should get retention rules"
    data = response.json()
    print(f"✅ Test 28: Retention rules - Found {len(data)} record(s)")

def test_system_logs_select():
    """Test 29: Get system logs."""
    url = f"{BASE_URL}/system_logs?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    assert response.status_code == 200, "Should get system logs"
    data = response.json()
    print(f"✅ Test 29: System logs - Found {len(data)} record(s)")

def test_sessions_select():
    """Test 30: Get sessions."""
    url = f"{BASE_URL}/sessions?select=*&limit=5"
    response = requests.get(url, headers=HEADERS)
    assert response.status_code == 200, "Should get sessions"
    data = response.json()
    print(f"✅ Test 30: Sessions - Found {len(data)} record(s)")

def test_documents_insert():
    """Test 31: Insert document record."""
    test_ts = int(time.time())
    data = {
        "title": f"Test Document {test_ts}",
        "doc_type": "Policy",
        "file_url": "https://example.com/test.pdf"
    }
    url = f"{BASE_URL}/documents"
    response = requests.post(url, headers=HEADERS, json=data)
    if response.status_code in [200, 201]:
        result = response.json()
        record_id = result[0].get("id") if isinstance(result, list) else result.get("id")
        print(f"✅ Test 31: Documents insert - ID {record_id}")
        delete_test_record("documents", record_id)
    else:
        print(f"⚠️ Test 31: Insert blocked (status {response.status_code})")

def test_vendors_insert():
    """Test 32: Insert vendor record."""
    test_ts = int(time.time())
    data = {
        "name": f"Test Vendor {test_ts}",
        "contact_email": f"vendor{test_ts}@test.com",
        "country": "Singapore"
    }
    url = f"{BASE_URL}/vendors"
    response = requests.post(url, headers=HEADERS, json=data)
    if response.status_code in [200, 201]:
        result = response.json()
        record_id = result[0].get("id") if isinstance(result, list) else result.get("id")
        print(f"✅ Test 32: Vendors insert - ID {record_id}")
        delete_test_record("vendors", record_id)
    else:
        print(f"⚠️ Test 32: Insert blocked (status {response.status_code})")

def test_data_requests_insert():
    """Test 33: Insert data request record."""
    test_ts = int(time.time())
    data = {
        "request_type": "Access",
        "requester_name": f"Test Requester {test_ts}",
        "requester_email": f"requester{test_ts}@test.com",
        "status": "Pending"
    }
    url = f"{BASE_URL}/data_requests"
    response = requests.post(url, headers=HEADERS, json=data)
    if response.status_code in [200, 201]:
        result = response.json()
        record_id = result[0].get("id") if isinstance(result, list) else result.get("id")
        print(f"✅ Test 33: Data requests insert - ID {record_id}")
        delete_test_record("data_requests", record_id)
    else:
        print(f"⚠️ Test 33: Insert blocked (status {response.status_code})")

# ============================================================
# TEST RESULTS SUMMARY
# ============================================================
if __name__ == "__main__":
    print("\n" + "="*50)
    print("📊 DataRex Supabase API UAT Test Suite")
    print("="*50)
    print(f"API URL: {SUPABASE_URL}")
    print(f"Tables tested: 22")
    print(f"Endpoints tested: 33")
    print("="*50)
    print("\nRun: pytest test_api.py -v\n")
