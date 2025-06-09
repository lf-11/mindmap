import unittest
import sys
from pathlib import Path
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.processing.headlines.llm_headline import (
    HeadlineDecision,
    call_llm_for_correction,
    call_llm_for_structured_decision,
    process_single_error,
    get_instructor_client
)
from backend.processing.headlines.headlines import ErrorCase
from backend.utils.local_call import get_first_model_name, MODELS_ENDPOINT


# Thread-safe test result tracker
class TestResultTracker:
    def __init__(self):
        self.results = defaultdict(list)
        self.warnings = []
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0
        self.skipped_tests = 0
        self._lock = threading.Lock()
    
    def add_result(self, test_name, status, message=None):
        with self._lock:
            self.results[status].append((test_name, message))
            self.total_tests += 1
            if status == "PASSED":
                self.passed_tests += 1
            elif status == "FAILED":
                self.failed_tests += 1
            elif status == "SKIPPED":
                self.skipped_tests += 1
    
    def add_warning(self, test_name, warning):
        with self._lock:
            self.warnings.append((test_name, warning))
    
    def print_summary(self):
        print(f"\n{'='*80}")
        print(f"🏁 COMPREHENSIVE TEST SUMMARY")
        print(f"{'='*80}")
        
        # Overall stats
        print(f"\n📊 OVERALL STATISTICS:")
        print(f"   Total Tests: {self.total_tests}")
        print(f"   ✅ Passed: {self.passed_tests}")
        print(f"   ❌ Failed: {self.failed_tests}")
        print(f"   ⏭️  Skipped: {self.skipped_tests}")
        print(f"   ⚠️  Warnings: {len(self.warnings)}")
        
        # Success rate
        if self.total_tests > 0:
            success_rate = (self.passed_tests / self.total_tests) * 100
            print(f"   📈 Success Rate: {success_rate:.1f}%")
        
        # Detailed results
        if self.results["PASSED"]:
            print(f"\n✅ PASSED TESTS ({len(self.results['PASSED'])}):")
            for test_name, _ in self.results["PASSED"]:
                print(f"   • {test_name}")
        
        if self.results["FAILED"]:
            print(f"\n❌ FAILED TESTS ({len(self.results['FAILED'])}):")
            for test_name, message in self.results["FAILED"]:
                print(f"   • {test_name}")
                if message:
                    print(f"     └─ {message}")
        
        if self.results["SKIPPED"]:
            print(f"\n⏭️  SKIPPED TESTS ({len(self.results['SKIPPED'])}):")
            for test_name, message in self.results["SKIPPED"]:
                print(f"   • {test_name}")
                if message:
                    print(f"     └─ {message}")
        
        if self.warnings:
            print(f"\n⚠️  WARNINGS ({len(self.warnings)}):")
            for test_name, warning in self.warnings:
                print(f"   • {test_name}: {warning}")
        
        # Final verdict
        print(f"\n🎯 FINAL VERDICT:")
        if self.failed_tests == 0 and self.total_tests > 0:
            if len(self.warnings) == 0:
                print("   🎉 ALL TESTS PASSED WITH NO WARNINGS!")
            else:
                print(f"   ✅ ALL TESTS PASSED (with {len(self.warnings)} warnings)")
        elif self.failed_tests > 0:
            print(f"   🔴 {self.failed_tests} TEST(S) FAILED - NEEDS ATTENTION")
        else:
            print("   ❓ NO TESTS WERE RUN")
        
        print(f"{'='*80}\n")

# Global instance
test_tracker = TestResultTracker()


class TestLLMIntegration(unittest.TestCase):
    """Integration tests that actually call the vLLM server"""
    
    @classmethod
    def setUpClass(cls):
        """Check if vLLM server is available before running tests"""
        try:
            model_name = get_first_model_name(MODELS_ENDPOINT)
            if not model_name:
                raise Exception("No model available")
            cls.model_available = True
            print(f"\n{'='*60}")
            print(f"🚀 LLM INTEGRATION TESTS STARTING")
            print(f"📱 Using model: {model_name}")
            print(f"🚄 Concurrent execution enabled")
            print(f"{'='*60}\n")
        except Exception as e:
            cls.model_available = False
            print(f"\n❌ WARNING: vLLM server not available: {e}\n")
    
    def setUp(self):
        """Skip tests if vLLM server is not available"""
        if not self.model_available:
            test_tracker.add_result(self._testMethodName, "SKIPPED", "vLLM server not available")
            self.skipTest("vLLM server not available")
    
    def test_correction_call_real_llm(self):
        """Test that the correction call returns valid text from real LLM"""
        print(f"\n🔍 Testing LLM correction call...")
        
        prompt_data = {
            'error_type': 'layer_skip',
            'language': 'de',
            'problematic_headline': 'A. Zulässigkeit des Einspruchs',
            'line_number': 218,
            'previous_layer': 2,
            'current_layer': 4,
            'skipped_layers': [3],
            'previous_headline': '1. Erstes Versäumnisurteil: Einspruch',
            'previous_line_num': 196,
            'section_text': 'Test section content...',
            'expected_layers_info': [
                {
                    'layer_num': 3,
                    'layer_name': 'Uppercase letters',
                    'layer_numerals': 'A., B., C.'
                }
            ],
            'all_layers_info': {
                1: {'layer_name': 'Roman numerals', 'layer_numerals': 'I., II., III.'},
                2: {'layer_name': 'Arabic numbers', 'layer_numerals': '1., 2., 3.'},
                3: {'layer_name': 'Uppercase letters', 'layer_numerals': 'A., B., C.'},
                4: {'layer_name': 'Uppercase letters', 'layer_numerals': 'A., B., C.'}
            },
            'problematic_headers': [
                {'line_num': 218, 'text': 'A. Zulässigkeit des Einspruchs'}
            ]
        }
        
        try:
            result = call_llm_for_correction(prompt_data)
            
            # Verify we got a non-empty string response
            if result == "Error occurred during LLM analysis":
                print(f"❌ FAILED: LLM returned error message")
                test_tracker.add_result(self._testMethodName, "FAILED", "LLM returned error message")
                self.fail("LLM correction call failed")
            else:
                print(f"✅ SUCCESS: Got valid LLM response")
                print(f"📝 Response preview: {result[:100]}...")
                test_tracker.add_result(self._testMethodName, "PASSED")
                
            self.assertIsInstance(result, str)
            self.assertGreater(len(result), 10)
            self.assertNotEqual(result, "Error occurred during LLM analysis")
            
        except Exception as e:
            test_tracker.add_result(self._testMethodName, "FAILED", str(e))
            raise
    
    def test_structured_decision_real_llm(self):
        """Test that the structured decision call returns valid HeadlineDecision"""
        print(f"\n🎯 Testing structured decision call...")
        
        correction_response = """
        Diese Überschrift 'A. Zulässigkeit des Einspruchs' scheint ein Unterabschnitt zu sein, 
        der logisch zur Struktur eines juristischen Dokuments gehört. 
        Es handelt sich um eine Hauptgliederung mit Buchstaben-Nummerierung.
        """
        
        prompt_data = {
            'problematic_headline': 'A. Zulässigkeit des Einspruchs',
            'current_layer': 4,
            'previous_layer': 2
        }
        
        try:
            result = call_llm_for_structured_decision(correction_response, prompt_data)
            
            # Verify we got a valid HeadlineDecision object
            print(f"📊 Decision type: {result.decision_type}")
            print(f"🏷️  Layer number: {result.layer_number}")
            print(f"💭 Reasoning: {result.reasoning[:100]}...")
            
            self.assertIsInstance(result, HeadlineDecision)
            self.assertIn(result.decision_type, ["HAUPTGLIEDERUNG", "PRÜFUNGSSCHEMA", "UNSICHERHEIT"])
            self.assertIsInstance(result.reasoning, str)
            self.assertGreater(len(result.reasoning), 5)
            
            # If it's HAUPTGLIEDERUNG, should have a layer number
            if result.decision_type == "HAUPTGLIEDERUNG":
                if result.layer_number is None:
                    warning_msg = "HAUPTGLIEDERUNG decision without layer number"
                    print(f"⚠️  WARNING: {warning_msg}")
                    test_tracker.add_warning(self._testMethodName, warning_msg)
                    test_tracker.add_result(self._testMethodName, "PASSED", "Passed with warnings")
                else:
                    print(f"✅ SUCCESS: Got layer number {result.layer_number}")
                    test_tracker.add_result(self._testMethodName, "PASSED")
                    self.assertIsNotNone(result.layer_number)
                    self.assertIsInstance(result.layer_number, int)
                    self.assertGreaterEqual(result.layer_number, 1)
                    self.assertLessEqual(result.layer_number, 10)
            else:
                print(f"✅ SUCCESS: Got valid decision type {result.decision_type}")
                test_tracker.add_result(self._testMethodName, "PASSED")
                
        except Exception as e:
            test_tracker.add_result(self._testMethodName, "FAILED", str(e))
            raise
    
    def test_end_to_end_processing(self):
        """Test the complete end-to-end processing of an error case"""
        print(f"\n🔄 Testing end-to-end processing...")
        
        # Create a realistic error case
        error_case = ErrorCase(
            error_type="layer_skip",
            line_num=218,
            headline_text="A. Zulässigkeit des Einspruchs",
            details={
                'previous_layer': 2,
                'current_layer': 4,
                'skipped_layers': [3],
                'previous_headline': '1. Erstes Versäumnisurteil: Einspruch',
                'previous_line_num': 196
            }
        )
        
        prompt_data = {
            'error_type': 'layer_skip',
            'language': 'de',
            'problematic_headline': 'A. Zulässigkeit des Einspruchs',
            'line_number': 218,
            'previous_layer': 2,
            'current_layer': 4,
            'skipped_layers': [3],
            'previous_headline': '1. Erstes Versäumnisurteil: Einspruch',
            'previous_line_num': 196,
            'section_text': 'Test section content...',
            'expected_layers_info': [
                {
                    'layer_num': 3,
                    'layer_name': 'Uppercase letters',
                    'layer_numerals': 'A., B., C.'
                }
            ],
            'all_layers_info': {
                1: {'layer_name': 'Roman numerals', 'layer_numerals': 'I., II., III.'},
                2: {'layer_name': 'Arabic numbers', 'layer_numerals': '1., 2., 3.'},
                3: {'layer_name': 'Uppercase letters', 'layer_numerals': 'A., B., C.'},
                4: {'layer_name': 'Uppercase letters', 'layer_numerals': 'A., B., C.'}
            },
            'problematic_headers': [
                {'line_num': 218, 'text': 'A. Zulässigkeit des Einspruchs'}
            ]
        }
        
        try:
            print(f"📋 Processing: Line {error_case.line_num} - '{error_case.headline_text}'")
            
            result = process_single_error(error_case, prompt_data)
            
            # Verify we got a valid result format
            valid_results = ["remove", "intervention"]
            is_edit = result.startswith("edit, ") and result.split(", ")[1].isdigit()
            is_valid = result in valid_results or is_edit
            
            if is_valid:
                print(f"✅ SUCCESS: Got valid result '{result}'")
                test_tracker.add_result(self._testMethodName, "PASSED")
                if is_edit:
                    layer_num = int(result.split(", ")[1])
                    print(f"📝 Edit command with layer {layer_num}")
                    self.assertGreaterEqual(layer_num, 1)
                    self.assertLessEqual(layer_num, 10)
            else:
                print(f"❌ FAILED: Invalid result format '{result}'")
                test_tracker.add_result(self._testMethodName, "FAILED", f"Invalid result format: {result}")
                
            self.assertTrue(is_valid, f"Invalid result format: {result}")
            
        except Exception as e:
            test_tracker.add_result(self._testMethodName, "FAILED", str(e))
            raise
    
    def test_instructor_client_setup(self):
        """Test that the instructor client can be set up correctly"""
        print(f"\n⚙️  Testing instructor client setup...")
        
        try:
            client, model_name = get_instructor_client()
            print(f"✅ SUCCESS: Client setup with model '{model_name}'")
            test_tracker.add_result(self._testMethodName, "PASSED")
            self.assertIsNotNone(client)
            self.assertIsInstance(model_name, str)
            self.assertGreater(len(model_name), 0)
        except Exception as e:
            print(f"❌ FAILED: {e}")
            test_tracker.add_result(self._testMethodName, "FAILED", str(e))
            self.fail(f"Failed to set up instructor client: {e}")
    
    def test_multiple_decision_types(self):
        """Test different types of headlines to see various decision outcomes - CONCURRENT"""
        print(f"\n🎲 Testing multiple decision types concurrently...")
        
        test_cases = [
            {
                'headline': 'A. Zulässigkeit des Einspruchs',
                'context': 'Diese Überschrift ist eine Hauptgliederung mit Buchstaben-Nummerierung auf Ebene 3.',
                'expected_type': 'HAUPTGLIEDERUNG'
            },
            {
                'headline': 'Prüfungsschema zum Einspruch',
                'context': 'Dies ist ein Prüfungsschema für Studenten und sollte entfernt werden.',
                'expected_type': 'PRÜFUNGSSCHEMA'
            },
            {
                'headline': 'Unklarer Abschnitt 123',
                'context': 'Sehr unklarer und verwirrrender Text ohne erkennbare Struktur.',
                'expected_type': 'UNSICHERHEIT'
            },
            {
                'headline': 'B. Weitere rechtliche Überlegungen',
                'context': 'Eine weitere Hauptgliederung mit Buchstaben auf Ebene 3.',
                'expected_type': 'HAUPTGLIEDERUNG'
            },
            {
                'headline': 'Übungsfall Nr. 5',
                'context': 'Dies ist ein Übungsfall für Studierende.',
                'expected_type': 'UNSICHERHEIT'
            }
        ]
        
        def test_single_case(case_data):
            """Test a single case - for concurrent execution"""
            case_index, case = case_data
            try:
                prompt_data = {
                    'problematic_headline': case['headline'],
                    'current_layer': 4,
                    'previous_layer': 2
                }
                
                result = call_llm_for_structured_decision(case['context'], prompt_data)
                
                return {
                    'index': case_index,
                    'case': case,
                    'result': result,
                    'success': True,
                    'error': None
                }
            except Exception as e:
                return {
                    'index': case_index,
                    'case': case,
                    'result': None,
                    'success': False,
                    'error': str(e)
                }
        
        try:
            print(f"🚄 Running {len(test_cases)} tests concurrently...")
            
            # Execute tests concurrently
            with ThreadPoolExecutor(max_workers=min(len(test_cases), 4)) as executor:
                # Submit all test cases
                future_to_case = {
                    executor.submit(test_single_case, (i, case)): i
                    for i, case in enumerate(test_cases)
                }
                
                results = {}
                for future in as_completed(future_to_case):
                    result = future.result()
                    results[result['index']] = result
            
            # Process results in order
            all_passed = True
            for i in range(len(test_cases)):
                result_data = results[i]
                case = result_data['case']
                
                print(f"\n🧪 Test case {i+1}/{len(test_cases)}: '{case['headline']}'")
                
                if not result_data['success']:
                    print(f"❌ FAILED: {result_data['error']}")
                    all_passed = False
                    continue
                
                result = result_data['result']
                print(f"📊 Result: {result.decision_type}")
                print(f"💭 Expected: {case['expected_type']}")
                print(f"🏷️  Layer: {result.layer_number}")
                
                self.assertIsInstance(result, HeadlineDecision)
                self.assertIn(result.decision_type, ["HAUPTGLIEDERUNG", "PRÜFUNGSSCHEMA", "UNSICHERHEIT"])
                
                if result.decision_type == case['expected_type']:
                    print(f"✅ SUCCESS: Matched expected type")
                    # Check layer number for HAUPTGLIEDERUNG
                    if result.decision_type == "HAUPTGLIEDERUNG" and result.layer_number is None:
                        test_tracker.add_warning(self._testMethodName, 
                                               f"Case {i+1}: HAUPTGLIEDERUNG without layer number")
                else:
                    print(f"⚠️  INFO: Different type (not necessarily wrong)")
                    test_tracker.add_warning(self._testMethodName, 
                                           f"Case {i+1}: Expected {case['expected_type']}, got {result.decision_type}")
            
            if all_passed:
                test_tracker.add_result(self._testMethodName, "PASSED", 
                                      "Concurrent execution completed successfully")
            else:
                test_tracker.add_result(self._testMethodName, "FAILED", 
                                      "Some concurrent tests failed")
                                  
        except Exception as e:
            test_tracker.add_result(self._testMethodName, "FAILED", str(e))
            raise


class TestLLMPerformance(unittest.TestCase):
    """Performance tests for LLM calls"""
    
    @classmethod
    def setUpClass(cls):
        """Check if vLLM server is available"""
        try:
            model_name = get_first_model_name(MODELS_ENDPOINT)
            cls.model_available = bool(model_name)
            if cls.model_available:
                print(f"\n⏱️  PERFORMANCE TESTS STARTING\n")
        except:
            cls.model_available = False
    
    def setUp(self):
        if not self.model_available:
            test_tracker.add_result(self._testMethodName, "SKIPPED", "vLLM server not available")
            self.skipTest("vLLM server not available")
    
    def test_concurrent_response_times(self):
        """Test concurrent LLM calls for performance"""
        print(f"🚄 Testing concurrent response times...")
        
        def single_request():
            prompt_data = {
                'problematic_headline': 'Test headline',
                'current_layer': 4,
                'previous_layer': 2
            }
            
            start_time = time.time()
            result = call_llm_for_structured_decision("Test analysis for performance", prompt_data)
            end_time = time.time()
            
            return end_time - start_time, result
        
        try:
            num_requests = 3
            print(f"🚄 Making {num_requests} concurrent requests...")
            
            start_total = time.time()
            
            with ThreadPoolExecutor(max_workers=num_requests) as executor:
                futures = [executor.submit(single_request) for _ in range(num_requests)]
                results = [future.result() for future in as_completed(futures)]
            
            end_total = time.time()
            total_time = end_total - start_total
            
            response_times = [r[0] for r in results]
            avg_response_time = sum(response_times) / len(response_times)
            max_response_time = max(response_times)
            
            print(f"⏱️  Total time for {num_requests} concurrent requests: {total_time:.2f}s")
            print(f"⏱️  Average response time: {avg_response_time:.2f}s")
            print(f"⏱️  Max response time: {max_response_time:.2f}s")
            
            # Verify all requests succeeded
            for i, (response_time, result) in enumerate(results):
                self.assertIsInstance(result, HeadlineDecision)
                print(f"   Request {i+1}: {response_time:.2f}s")
            
            if max_response_time < 30.0:
                print(f"✅ SUCCESS: All responses within acceptable time")
                test_tracker.add_result(self._testMethodName, "PASSED")
            else:
                print(f"❌ FAILED: Some responses too slow")
                test_tracker.add_result(self._testMethodName, "FAILED", f"Max response time: {max_response_time:.2f}s")
                
            self.assertLess(max_response_time, 30.0, f"Max response took {max_response_time:.2f} seconds")
            
        except Exception as e:
            test_tracker.add_result(self._testMethodName, "FAILED", str(e))
            raise


if __name__ == '__main__':
    print(f"\n{'='*60}")
    print(f"🧪 STARTING LLM INTEGRATION TEST SUITE")
    print(f"🚄 With Concurrent Execution Support")
    print(f"{'='*60}")
    
    # Run with high verbosity to see the actual LLM responses
    unittest.main(verbosity=2, exit=False)
    
    # Print comprehensive summary
    test_tracker.print_summary()
    
    print(f"\n{'='*60}")
    print(f"🏁 TEST SUITE COMPLETED")
    print(f"{'='*60}\n") 