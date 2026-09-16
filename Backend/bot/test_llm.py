import unittest

from llm import _extract_text, _model_missing


class ExtractTests(unittest.TestCase):
    def test_string_content(self):
        data = {"choices": [{"message": {"content": "  merhaba  "}}]}
        self.assertEqual(_extract_text(data), "merhaba")

    def test_list_content(self):
        data = {
            "choices": [
                {
                    "message": {
                        "content": [
                            {"type": "text", "text": "{"},
                            {"type": "output_text", "text": "}"},
                        ]
                    }
                }
            ]
        }
        self.assertEqual(_extract_text(data), "{}")

    def test_reasoning_fallback(self):
        data = {
            "choices": [
                {"message": {"content": "", "reasoning_content": '{"regions": []}'}}
            ]
        }
        self.assertEqual(_extract_text(data), '{"regions": []}')

    def test_empty(self):
        self.assertEqual(_extract_text({}), "")


class ModelMissingTests(unittest.TestCase):
    def test_404(self):
        self.assertTrue(_model_missing("HTTP 404: Model Not Found"))

    def test_unknown_model(self):
        self.assertTrue(_model_missing("The model does not exist"))

    def test_unrelated(self):
        self.assertFalse(_model_missing("HTTP 400: image too large"))


if __name__ == "__main__":
    unittest.main()
