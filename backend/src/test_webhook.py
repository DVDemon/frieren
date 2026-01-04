"""
Тестируем запуск workflow n8n по webhook: http://localhost:5678/webhook/homework-submission
Передаваемые данные соответствуют модели HomeworkSubmissionInfo

"""

import requests

url = "http://localhost:5678/webhook/homework-submission"

data = {
    "number": 1,
    "url": "https://github.com/DVDemon/hl_mai_lab_04",
    "comments": "TTesh workflow",
    "student": {
        "telegram": "@dvdzyuba"
    }
}

response = requests.post(url, json=data)
response.raise_for_status()

print(response.json())