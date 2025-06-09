#!/usr/bin/env python3
"""
Test runner for the PDF Mindmap project.

Usage:
    python tests/run_tests.py                    # Run all tests
    python tests/run_tests.py headlines          # Run only headline tests
    python tests/run_tests.py --verbose          # Run with verbose output
"""

import sys
import unittest
import argparse
import os
from pathlib import Path

# Add project root to path and change to project root
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
os.chdir(project_root)


def run_all_tests(verbosity=1):
    """Run all tests in the tests directory"""
    loader = unittest.TestLoader()
    suite = loader.discover('tests', pattern='test_*.py')
    runner = unittest.TextTestRunner(verbosity=verbosity)
    result = runner.run(suite)
    return result.wasSuccessful()


def run_headline_tests(verbosity=1):
    """Run only headline-related tests"""
    loader = unittest.TestLoader()
    suite = loader.discover('tests/backend/processing/headlines', pattern='test_*.py')
    runner = unittest.TextTestRunner(verbosity=verbosity)
    result = runner.run(suite)
    return result.wasSuccessful()


def main():
    parser = argparse.ArgumentParser(description='Run tests for PDF Mindmap project')
    parser.add_argument('test_type', nargs='?', choices=['headlines', 'all'], default='all',
                       help='Type of tests to run (default: all)')
    parser.add_argument('-v', '--verbose', action='store_true',
                       help='Verbose output')
    
    args = parser.parse_args()
    
    verbosity = 2 if args.verbose else 1
    
    print(f"Running {args.test_type} tests with verbosity level {verbosity}...")
    print("=" * 50)
    
    if args.test_type == 'headlines':
        success = run_headline_tests(verbosity)
    else:
        success = run_all_tests(verbosity)
    
    if success:
        print("\n" + "=" * 50)
        print("✅ All tests passed!")
        sys.exit(0)
    else:
        print("\n" + "=" * 50)
        print("❌ Some tests failed!")
        sys.exit(1)


if __name__ == '__main__':
    main() 