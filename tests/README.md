# Testing Guide

This directory contains unit tests for the PDF Mindmap project.

## Directory Structure

```
tests/
├── __init__.py
├── conftest.py                 # Common test configuration
├── run_tests.py               # Test runner script
├── README.md                  # This file
└── backend/                   # Tests mirroring backend structure
    └── processing/
        └── headlines/
            ├── __init__.py
            └── test_llm_headline.py    # Tests for LLM headline processing
```

## Running Tests

### Using unittest directly (Recommended)

```bash
# Run specific test file (from project root)
python -m unittest tests.backend.processing.headlines.test_llm_headline -v

# Run specific test class
python -m unittest tests.backend.processing.headlines.test_llm_headline.TestHeadlineDecision -v

# Run specific test method
python -m unittest tests.backend.processing.headlines.test_llm_headline.TestHeadlineDecision.test_hauptgliederung_decision -v
```

### Using pytest (if installed)

```bash
# Install pytest first
pip install pytest

# Run specific test file
pytest tests/backend/processing/headlines/test_llm_headline.py -v

# Run all tests in tests directory
pytest tests/ -v
```

### Running individual test files directly

```bash
# Run test file directly
cd tests/backend/processing/headlines/
python test_llm_headline.py
```

## Test Coverage

The current tests cover:

- **HeadlineDecision Pydantic Model**: Tests for the structured output model
- **Decision Parsing**: Tests for converting LLM decisions to action strings
- **LLM Calls**: Mocked tests for both correction and structured decision calls
- **Error Processing**: Tests for single and concurrent error processing
- **Error Handling**: Tests for various failure scenarios

## Key Features of the Tests

1. **Mocking**: All LLM calls are mocked to avoid actual API calls during testing
2. **Isolation**: Each test is independent and doesn't affect others
3. **Comprehensive Coverage**: Tests cover success cases, failure cases, and edge cases
4. **Fast Execution**: Tests run quickly due to mocking

## Test Results

The test suite includes 14 tests covering all major functionality:

- ✅ HeadlineDecision model validation
- ✅ Decision parsing for all three decision types (HAUPTGLIEDERUNG, PRÜFUNGSSCHEMA, UNSICHERHEIT)
- ✅ LLM call mocking for both correction and structured decision calls
- ✅ Error handling for failed LLM calls
- ✅ Single error processing
- ✅ Concurrent error processing

All tests pass successfully when run individually.

## Adding New Tests

When adding new functionality to the backend, follow these guidelines:

1. **Mirror the directory structure**: Create test files in `tests/` that mirror the structure in `backend/`
2. **Name test files with `test_` prefix**: e.g., `test_new_module.py`
3. **Use descriptive test method names**: e.g., `test_function_name_with_valid_input`
4. **Mock external dependencies**: Don't make real API calls or file operations in tests
5. **Test both success and failure cases**: Include error handling tests

## Example Test Structure

```python
import unittest
from unittest.mock import patch, MagicMock

class TestNewFeature(unittest.TestCase):
    def test_success_case(self):
        # Test the happy path
        pass
    
    def test_failure_case(self):
        # Test error handling
        pass
    
    @patch('module.external_dependency')
    def test_with_mocking(self, mock_dependency):
        # Test with mocked external calls
        mock_dependency.return_value = "expected_result"
        # ... test code
```

## Dependencies for Testing

The tests require the following packages:
- `unittest` (built-in)
- `instructor` (for Pydantic model testing)
- `pydantic` (for model validation)
- `openai` (mocked in tests)

## Continuous Integration

These tests are designed to be run in CI/CD pipelines. Use the direct unittest commands for reliable execution in automated environments. 