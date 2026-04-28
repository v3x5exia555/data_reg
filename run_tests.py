#!/usr/bin/env python3
"""
DataRex UAT Test Runner
Run all tests: python run_tests.py
Run specific: python run_tests.py frontend / api / all

Usage:
  ./run_tests.py           # Run all tests
  ./run_tests.py frontend  # Frontend only (Playwright)
  ./run_tests.py api     # API tests only (Supabase)
"""

import os
import sys
import subprocess

PROJECT_DIR = "/Users/tysonchua/Desktop/project/data-reg"
VENV_PYTHON = "/Users/tysonchua/Desktop/project/data-reg/venv/bin/python"
VENV_PIP = "/Users/tysonchua/Desktop/project/data-reg/venv/bin/pip"

os.chdir(PROJECT_DIR)


def print_header(msg):
    print("\n" + "="*50)
    print(f"  {msg}")
    print("="*50)


def check_dependencies():
    """Check and install required dependencies."""
    print_header("CHECKING DEPENDENCIES")
    
    # Check using venv Python
    try:
        result = subprocess.run(
            [VENV_PYTHON, "-m", "pip", "list"],
            capture_output=True,
            text=True,
            timeout=30
        )
        output = result.stdout
        
        deps = {
            "requests": "requests" in output,
            "playwright": "playwright" in output,
            "pytest": "pytest" in output
        }
        
        for dep, installed in deps.items():
            if installed:
                print(f"✅ {dep}: Installed")
            else:
                print(f"❌ {dep}: Not installed")
        
        # Check for missing
        missing = [k for k, v in deps.items() if not v]
        if missing:
            print(f"\n⚠️ Installing: {', '.join(missing)}")
            for dep in missing:
                try:
                    subprocess.check_call(
                        [VENV_PIP, "install", dep],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=60
                    )
                    print(f"   ✅ Installed {dep}")
                except Exception as e:
                    print(f"   ❌ Failed to install {dep}")
        
    except Exception as e:
        print(f"⚠️ Could not check dependencies: {e}")


def install_deps(deps):
    """Install missing dependencies."""
    for dep in deps:
        try:
            subprocess.check_call(
                [VENV_PIP, "install", dep],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=60
            )
            print(f"   ✅ Installed {dep}")
        except Exception as e:
            print(f"   ❌ Failed to install {dep}: {e}")


def run_tests(test_type="all", verbose=True):
    """Run the test suite."""
    
    if test_type == "all":
        print_header("RUNNING ALL TESTS")
        test_files = ["test_datarex.py", "test_api.py"]
    elif test_type == "frontend":
        print_header("RUNNING FRONTEND TESTS")
        test_files = ["test_datarex.py"]
    elif test_type == "api":
        print_header("RUNNING API TESTS")
        test_files = ["test_api.py"]
    else:
        print(f"❌ Unknown test type: {test_type}")
        return
    
    for test_file in test_files:
        if not os.path.exists(test_file):
            print(f"⚠️ Test file not found: {test_file}")
            continue
        
        print(f"\n📋 Running {test_file}...")
        print("-" * 40)
        
        # Use venv Python and subprocess
        cmd = [VENV_PYTHON, "-m", "pytest", test_file]
        if verbose:
            cmd.append("-v")
        cmd.append("--tb=short")
        
        result = subprocess.run(cmd)
        
        if result.returncode == 0:
            print(f"✅ {test_file}: PASSED")
        else:
            print(f"❌ {test_file}: FAILED (exit code {result.returncode})")
    
    print_header("TESTS COMPLETE")


def main():
    """Main entry point."""
    args = sys.argv[1:] if len(sys.argv) > 1 else ["all"]
    
    test_type = args[0].lower() if args else "all"
    
    # Check dependencies first
    check_dependencies()
    
    # Run tests
    if test_type == "help":
        print("""
DataRex UAT Test Runner

Usage: python run_tests.py [type]

Types:
  all       - Run all tests (default)
  frontend  - Run frontend tests only (Playwright)
  api       - Run API tests only (Supabase)

Examples:
  python run_tests.py          # Run all tests
  python run_tests.py frontend  # Frontend only
  python run_tests.py api       # API tests only
  
  # Run with pytest directly:
  pytest test_datarex.py -v
  pytest test_api.py -v
  pytest -v                    # All tests
""")
    else:
        run_tests(test_type)


if __name__ == "__main__":
    main()