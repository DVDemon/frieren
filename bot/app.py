#!/usr/bin/env python3
"""
Telegram бот "Помощник преподавателя МАИ"
Использует aiogram для взаимодействия с Telegram API
"""

import asyncio
import logging
import os
import aiohttp
import json
from datetime import datetime
from typing import Dict, Any

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.utils.keyboard import ReplyKeyboardBuilder
import cv2
import dlib
import numpy as np
from PIL import Image


# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Конфигурация из переменных окружения
BOT_TOKEN = os.getenv("BOT_TOKEN", "7082344855:AAEpIzrfovj_gH6oO2xlxbUO_R89z9Wk_Oo")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api")
N8N_BASE_URL = os.getenv("N8N_BASE_URL", "http://localhost:5678")

# Проверка обязательных переменных окружения
if not BOT_TOKEN:
    logger.error("BOT_TOKEN не установлен!")
    raise ValueError("BOT_TOKEN должен быть установлен в переменных окружения")

# Состояния FSM
class CountFacesState(StatesGroup):
    waiting_for_photo = State()
    waiting_for_lecture_number_for_capacity = State()
    waiting_for_max_students = State()

class RegistrationStates(StatesGroup):
    waiting_for_name = State()
    waiting_for_github = State()
    waiting_for_group = State()

class CheckInStates(StatesGroup):
    waiting_for_qr_photo = State()

class HomeworkStates(StatesGroup):
    waiting_for_number = State()
    waiting_for_repo = State()
    waiting_for_comment = State()

class LectureMaterialsStates(StatesGroup):
    waiting_for_lecture_number = State()



# Инициализация бота
bot = Bot(token=BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)

# Временное хранилище данных пользователей
user_data: Dict[int, Dict[str, Any]] = {}

async def update_student_chat_id(telegram: str, chat_id: int) -> bool:
    """
    Обновляет chat_id студента в базе данных
    """
    try:
        async with aiohttp.ClientSession() as session:
            # Используем endpoint с body параметром
            async with session.put(
                f"{API_BASE_URL}/students/by-telegram/{telegram}/chat-id-body",
                json={"chat_id": chat_id},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    logger.debug(f"Successfully updated chat_id for {telegram}: {chat_id}")
                    return True
                elif response.status == 404:
                    # Студент не найден - это нормально, не логируем как ошибку
                    logger.debug(f"Student not found for telegram {telegram}, skipping chat_id update")
                    return False
                else:
                    error_text = await response.text()
                    logger.warning(f"Failed to update chat_id for {telegram}: {response.status} - {error_text}")
                    return False
    except Exception as e:
        logger.error(f"Error updating chat_id for {telegram}: {e}")
        return False

# Middleware для автоматического обновления chat_id при любом сообщении
@dp.message.middleware()
async def update_chat_id_middleware(handler, event: types.Message, data):
    """
    Middleware для автоматического обновления chat_id при любом сообщении от студента
    """
    if event.from_user:
        telegram_username = event.from_user.username
        if telegram_username:
            telegram = f"@{telegram_username}"
            # Обновляем chat_id асинхронно, не блокируя обработку сообщения
            asyncio.create_task(update_student_chat_id(telegram, event.chat.id))
        else:
            # Если нет username, используем user_{id} формат
            telegram = f"user_{event.from_user.id}"
            asyncio.create_task(update_student_chat_id(telegram, event.chat.id))
    
    return await handler(event, data)

def get_main_menu() -> ReplyKeyboardMarkup:
    """Создает главное меню бота"""
    builder = ReplyKeyboardBuilder()
    builder.add(KeyboardButton(text="Регистрация"))
    builder.add(KeyboardButton(text="Check-in на лекции"))
    builder.add(KeyboardButton(text="Отправка домашнего задания"))
    builder.add(KeyboardButton(text="Получение расписания лекций"))
    builder.add(KeyboardButton(text="Проверка вместимости лекции"))
    builder.add(KeyboardButton(text="Получение информации о успеваемости"))
    builder.add(KeyboardButton(text="Получение материалов лекций"))
    builder.add(KeyboardButton(text="Информация о домашних заданиях"))
    builder.add(KeyboardButton(text="Проверка домашних заданий (для преподавателя)"))
    builder.add(KeyboardButton(text="Подсчет студентов на лекции (для преподавателя)"))
    builder.adjust(2)
    return builder.as_markup(resize_keyboard=True)

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    """Обработчик команды /start"""
    welcome_text = """
🤖 Добро пожаловать в бота "Помощник преподавателя МАИ"!

Этот бот поможет вам:
• Зарегистрироваться в системе
• Отметиться на лекциях
• Отправить домашние задания
• Получить информацию о домашних заданиях
• Получить расписание и материалы
• Узнать о своей успеваемости

    """
    try:
        logger.error(f"Проверяю регистрацию для @{message.from_user.username}")
        
        async with aiohttp.ClientSession() as session:
            # Получаем информацию о преподавателе
            is_teacher : bool = False
            async with session.get(f"{API_BASE_URL}/teachers/by-telegram/@{message.from_user.username}", timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    is_teacher = True
                    user_info = await response.json()
                    logger.info(f"Получены данные о преподавателе: {user_info}")
                    welcome_text += f"Вы являетесь преподавателем {user_info.get('full_name')}\n"
                    # Получаем информацию о группах преподавателя
                    async with session.get(f"{API_BASE_URL}/teachers/{user_info.get('id')}/groups", timeout=aiohttp.ClientTimeout(total=10)) as teacher_groups_response:
                        if teacher_groups_response.status == 200:
                            teacher_groups = await teacher_groups_response.json()
                            #welcome_text += f"• Группы: {teacher_groups.get('group_number')}\n"
                            for group in teacher_groups:
                                welcome_text += f"  • Группа: {group.get('group_number')}\n"
                        else:
                            logger.error(f"Не удалось получить информацию о группах преподавателя: {teacher_groups_response.status}")
                            await message.answer("❌ Не удалось получить информацию о группах преподавателя. Попробуйте позже.", reply_markup=get_main_menu())
                            return

            # Получаем информацию о студенте
            if not is_teacher:
                async with session.get(f"{API_BASE_URL}/students/by-telegram/@{message.from_user.username}", timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        user_info = await response.json()
                        logger.error(f"Получены данные о студенте: {user_info}")
                        
                        # chat_id будет обновлен автоматически через middleware при любом сообщении
                        
                        welcome_text += f"Вы уже зарегистрированы в системе со следующими данными:\n"
                        welcome_text += f"• ФИО: {user_info.get('full_name')}\n"
                        welcome_text += f"• Группа: {user_info.get('group_number')}\n"
                        welcome_text += f"• Telegram: {user_info.get('telegram')}\n"
                        welcome_text += f"• GitHub: {user_info.get('github')}\n\n"

                        # Получаем варианты домашних заданий для студента
                        logger.info(f"Запрашиваю данные по вариантам для {message.from_user.username}")
                        async with session.get(f"{API_BASE_URL}/student-homework-variants/student/{user_info.get('id')}", timeout=aiohttp.ClientTimeout(total=10)) as variants_response:
                            if variants_response.status == 200:
                                variants = await variants_response.json()

                                # Получаем данные по домашним заданиям
                                logger.info(f"Запрашиваем данные по домашним заданиям для {message.from_user.username}")
                                async with session.get(f"{API_BASE_URL}/homework/", timeout=aiohttp.ClientTimeout(total=10)) as homework_response:
                                    homework_dict = {}
                                    if homework_response.status == 200:
                                        homework = await homework_response.json()
                                        for h in homework:
                                            homework_dict[h.get('id')] = h.get('number')

                                    # Формируем информацию о вариантах
                                    for v in variants:
                                        welcome_text += f" Задание №{homework_dict.get(v.get('homework_id'))} Вариант {v.get('variant_number')}\n"
                        # Получаем информацию о преподавателе по группе
                        async with session.get(f"{API_BASE_URL}/teachers/by-group/{user_info.get('group_number')}", timeout=aiohttp.ClientTimeout(total=10)) as teachers_response:
                            if teachers_response.status == 200:
                                teachers = await teachers_response.json()
                                for t in teachers:
                                    welcome_text += f"\nПреподаватель: {t.get('full_name')}\n\n"
                    

    except asyncio.TimeoutError:
        logger.error(f"Таймаут при получении информации о студенте для @{message.from_user.username}")
        await message.answer("❌ Превышено время ожидания ответа от сервера. Попробуйте позже.", reply_markup=get_main_menu())
        return
    except Exception as e:
        logger.error(f"Ошибка при получении информации о студенте: {e}")
        await message.answer("❌ Не удалось подключиться к серверу. Попробуйте позже.", reply_markup=get_main_menu())
        return

    welcome_text = welcome_text + f"Выберите нужную функцию из меню ниже:"

    await message.answer(welcome_text, reply_markup=get_main_menu())
    logger.info(f"Пользователь {message.from_user.id} запустил бота")

@dp.message(lambda message: message.text == "Проверка домашних заданий (для преподавателя)")
async def homework_review_start(message: types.Message, state: FSMContext):
    """Начало процесса проверки домашних заданий"""

    try:
        logger.info(f"Проверяю регистрацию для @{message.from_user.username}")
        
        async with aiohttp.ClientSession() as session:

            async with session.get(f"{API_BASE_URL}/teachers/by-telegram/@{message.from_user.username}", timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    user_info = await response.json()
                    logger.info(f"Получены данные о преподавателе: {user_info}")
                    if user_info.get('is_deleted'):
                        await message.answer("❌ Ваш аккаунт удален из системы. Пожалуйста, обратитесь к администратору.")
                        await state.clear()
                        return
                    else:
                        # Saving teacher id in state
                        await state.update_data(teacher_id=user_info.get('id'))
                        await message.answer(f"✅ Вы являетесь преподавателем {user_info.get('id')}.")
                        logger.info(f"Получение домашних заданий для преподавателя {user_info.get('id')}")
                        
                        # Сразу получаем домашние задания
                        try:
                            async with session.get(f"{API_BASE_URL}/homework_review/pending-by-teacher/{user_info.get('id')}", timeout=aiohttp.ClientTimeout(total=10)) as homework_response:
                                logger.info(f"API ответ: статус {homework_response.status} для teacher_id {user_info.get('id')}")
                                if homework_response.status == 200:
                                    homework_reviews = await homework_response.json()
                                    logger.info(f"Получены данные о домашних заданиях: {len(homework_reviews)}")
                                    
                                    if homework_reviews:
                                        await message.answer(f"📋 Найдено {len(homework_reviews)} домашних заданий на проверку:")
                                        # Show fill_name of student, send_date, github of student, number of homework
                                        for homework_review in homework_reviews:
                                            performance_text = ""
                                            if homework_review.get('ai_percentage') is not None:
                                                ai_level = "🔴 Высокий" if homework_review['ai_percentage'] > 70 else "🟡 Средний" if homework_review['ai_percentage'] > 30 else "🟢 Низкий"
                                                performance_text += f"   🤖 Уровень AI: {homework_review['ai_percentage']}% ({ai_level})\n"
                                            
                                            if homework_review.get('comments'):
                                                performance_text += f"   💬 Комментарий: {homework_review['comments']}\n"
                                            await message.answer(f"👤 {homework_review.get('student').get('full_name')}\n"
                                                                 f"👥 {homework_review.get('student').get('telegram')}\n"
                                                                 f"📅 {homework_review.get('send_date')}\n"
                                                                 f"📦 {homework_review.get('student').get('github')}\n"
                                                                 f"🏠 {homework_review.get('number')}\n"
                                                                 f"{performance_text}")
                                        await message.answer("Выберите следующее действие:", reply_markup=get_main_menu())
                                    else:
                                        await message.answer("📋 Нет домашних заданий на проверку.", reply_markup=get_main_menu())
                                else:
                                    await message.answer("❌ Не удалось получить список домашних заданий. Попробуйте позже.", reply_markup=get_main_menu())
                        except Exception as e:
                            logger.error(f"Ошибка при получении домашних заданий: {e}")
                            await message.answer("❌ Не удалось получить список домашних заданий. Попробуйте позже.", reply_markup=get_main_menu())
                        
                        await state.clear()
                        return
                        
                else:
                    await message.answer("❌ Вы не являетесь преподавателем. Пожалуйста, обратитесь к администратору.", reply_markup=get_main_menu())
                    await state.clear()
                    return
    except asyncio.TimeoutError:
        logger.error(f"Таймаут при проверке регистрации для @{message.from_user.username}")
        await message.answer("❌ Превышено время ожидания ответа от сервера. Попробуйте позже.", reply_markup=get_main_menu())
        await state.clear()
        return
    except Exception as e:
        logger.error(f"Ошибка при проверке регистрации для @{message.from_user.username}: {e}")
        await message.answer("❌ Не удалось подключиться к серверу. Попробуйте позже.", reply_markup=get_main_menu())
        await state.clear()
        return

    await state.clear()


@dp.message(lambda message: message.text == "Подсчет студентов на лекции (для преподавателя)")
async def count_faces(message: types.Message, state: FSMContext):
    """Начало процесса проверки домашних заданий"""

    try:
        logger.info(f"Проверяю регистрацию для @{message.from_user.username}")
        
        async with aiohttp.ClientSession() as session:

            async with session.get(f"{API_BASE_URL}/teachers/by-telegram/@{message.from_user.username}", timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    user_info = await response.json()
                    logger.info(f"Получены данные о преподавателе: {user_info}")
                    if user_info.get('is_deleted'):
                        await message.answer("❌ Ваш аккаунт удален из системы. Пожалуйста, обратитесь к администратору.", reply_markup=get_main_menu())
                        await state.clear()
                        return
                    else:
                        # Saving teacher id in state
                        await state.update_data(teacher_id=user_info.get('id'))
                        await state.set_state(CountFacesState.waiting_for_photo)
                        await message.answer(
                            "📸 Давайте посчитаем студентов\n\n"
                            "Пожалуйста, отправьте фотографию или файл изображения аудитории.\n\n"
                            "Поддерживаемые форматы:\n"
                            "• Фотографии (JPG, PNG)\n"
                            "• Файлы изображений (JPG, PNG, GIF, BMP, TIFF, WEBP)",
                            reply_markup=types.ReplyKeyboardRemove()
                            )
                        return
                        
                else:
                    await message.answer("❌ Вы не являетесь преподавателем. Пожалуйста, обратитесь к администратору.", reply_markup=get_main_menu())
                    await state.clear()
                    return
    except asyncio.TimeoutError:
        logger.error(f"Таймаут при проверке регистрации для @{message.from_user.username}")
        await message.answer("❌ Превышено время ожидания ответа от сервера. Попробуйте позже.", reply_markup=get_main_menu())
        await state.clear()
        return
    except Exception as e:
        logger.error(f"Ошибка при проверке регистрации для @{message.from_user.username}: {e}")
        await message.answer("❌ Не удалось подключиться к серверу. Попробуйте позже.", reply_markup=get_main_menu())
        await state.clear()
        return

    await state.clear()

async def process_image_for_faces(image_bytes: bytes, username: str) -> tuple[int, str]:
    """
    Универсальная функция для обработки изображения и подсчета лиц
    
    Args:
        image_bytes: Байты изображения
        username: Имя пользователя для логирования
    
    Returns:
        tuple: (количество_лиц, размер_изображения_строка)
    """
    try:
        # Открываем изображение
        logger.info(f"Открываем изображение для подсчета лиц студентов для @{username}")
        image = Image.open(image_bytes)

        # Преобразуем изображение PIL в массив numpy для OpenCV
        image_np = np.array(image.convert('RGB'))
        # OpenCV использует BGR, а не RGB
        image_cv = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

        # Инициализируем детектор лиц dlib
        logger.info(f"Инициализируем детектор лиц dlib для @{username}")
        face_detector = dlib.get_frontal_face_detector()

        # Конвертация в оттенки серого (ускоряет работу детектора)
        logger.info(f"Конвертация в оттенки серого для @{username}")
        gray = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)

        # Обнаружение лиц на изображении
        logger.info(f"Обнаружение лиц на изображении для @{username}")
        faces = face_detector(gray)

        # Счетчик лиц
        face_count = len(faces)
        logger.info(f"Найдено {face_count} лиц для @{username}")
        
        # Размер изображения
        image_size = f"{image_cv.shape[1]}x{image_cv.shape[0]} пикселей"
        
        return face_count, image_size
        
    except Exception as e:
        logger.error(f"Ошибка при обработке изображения для подсчета лиц: {e}")
        raise e



@dp.message(CountFacesState.waiting_for_photo)
async def process_any_message_in_photo_state(message: types.Message, state: FSMContext):
    """Универсальный обработчик для любых сообщений в состоянии ожидания фото"""
    logger.info(f"Получено сообщение в состоянии ожидания фото от @{message.from_user.username}")
    logger.info(f"Тип контента: {message.content_type}")
    logger.info(f"Есть фото: {bool(message.photo)}")
    logger.info(f"Есть документ: {bool(message.document)}")
    
    if message.document:
        logger.info(f"Документ: {message.document.file_name}, MIME: {message.document.mime_type}")
    
    try:
        # Обрабатываем фотографии
        if message.photo:
            logger.info("Обрабатываем фотографию")
            photo = message.photo[-1]  # Берем самое большое разрешение
            file = await bot.get_file(photo.file_id)
            photo_bytes = await bot.download_file(file.file_path)
            face_count, image_size = await process_image_for_faces(photo_bytes, message.from_user.username)
            
            # Формируем результат для фото
            if face_count == 0:
                result_message = "👥 Результат подсчета студентов:\n\n"
                result_message += "❌ Лица студентов не обнаружены на фотографии.\n\n"
                result_message += "💡 Рекомендации:\n"
                result_message += "• Убедитесь, что фотография четкая\n"
                result_message += "• Проверьте освещение в аудитории\n"
                result_message += "• Убедитесь, что студенты видны на фото\n"
                result_message += "• Попробуйте сделать фото с другого ракурса"
            else:
                result_message = "👥 Результат подсчета студентов:\n\n"
                result_message += f"✅ Обнаружено лиц: {face_count}\n\n"
                result_message += f"• Размер изображения: {image_size}\n"
                
                # Добавляем рекомендации
                if face_count < 5:
                    result_message += "\n💡 Рекомендации:\n"
                    result_message += "• Возможно, стоит сделать фото с более широким углом\n"
                    result_message += "• Проверьте, все ли студенты попали в кадр"
                elif face_count > 50:
                    result_message += "\n💡 Рекомендации:\n"
                    result_message += "• Большое количество лиц - проверьте качество детекции\n"
                    result_message += "• Возможно, есть ложные срабатывания"
            
            await message.answer(result_message)
            logger.info(f"Подсчет лиц завершен для пользователя {message.from_user.id}: найдено {face_count} лиц")
            
            # Сохраняем количество найденных лиц и переходим к запросу номера лекции
            await state.update_data(detected_faces=face_count)
            await state.set_state(CountFacesState.waiting_for_lecture_number_for_capacity)
            await message.answer(
                "📚 Теперь введите номер лекции для обновления максимального количества студентов:",
                reply_markup=types.ReplyKeyboardRemove()
            )
            
        # Обрабатываем документы с изображениями
        elif message.document and message.document.mime_type and message.document.mime_type.startswith('image/'):
            logger.info("Обрабатываем файл изображения")
            document = message.document
            file = await bot.get_file(document.file_id)
            file_bytes = await bot.download_file(file.file_path)
            face_count, image_size = await process_image_for_faces(file_bytes, message.from_user.username)
            
            # Формируем результат для файла
            if face_count == 0:
                result_message = "👥 Результат подсчета студентов:\n\n"
                result_message += "❌ Лица студентов не обнаружены на изображении.\n\n"
                result_message += "💡 Рекомендации:\n"
                result_message += "• Убедитесь, что изображение четкое\n"
                result_message += "• Проверьте освещение в аудитории\n"
                result_message += "• Убедитесь, что студенты видны на изображении\n"
                result_message += "• Попробуйте использовать другое изображение"
            else:
                result_message = "👥 Результат подсчета студентов:\n\n"
                result_message += f"✅ Обнаружено лиц: {face_count}\n\n"
                result_message += f"• Размер изображения: {image_size}\n"
                result_message += f"• Тип файла: {document.mime_type}\n"
                result_message += f"• Размер файла: {document.file_size / 1024:.1f} КБ\n"
                
                # Добавляем рекомендации
                if face_count < 5:
                    result_message += "\n💡 Рекомендации:\n"
                    result_message += "• Возможно, стоит использовать изображение с более широким углом\n"
                    result_message += "• Проверьте, все ли студенты попали в кадр"
                elif face_count > 50:
                    result_message += "\n💡 Рекомендации:\n"
                    result_message += "• Большое количество лиц - проверьте качество детекции\n"
                    result_message += "• Возможно, есть ложные срабатывания"
            
            await message.answer(result_message)
            logger.info(f"Подсчет лиц завершен для пользователя {message.from_user.id}: найдено {face_count} лиц")
            
            # Сохраняем количество найденных лиц и переходим к запросу номера лекции
            await state.update_data(detected_faces=face_count)
            await state.set_state(CountFacesState.waiting_for_lecture_number_for_capacity)
            await message.answer(
                "📚 Теперь введите номер лекции для обновления максимального количества студентов:",
                reply_markup=types.ReplyKeyboardRemove()
            )
            
        # Неподдерживаемый тип сообщения
        else:
            logger.warning(f"Неподдерживаемый тип сообщения: {message.content_type}")
            await message.answer(
                "❌ Пожалуйста, отправьте фотографию или файл изображения аудитории.\n\n"
                "Поддерживаемые форматы:\n"
                "• Фотографии (JPG, PNG)\n"
                "• Файлы изображений (JPG, PNG, GIF, BMP, TIFF, WEBP)\n\n"
                "Текущий тип сообщения не поддерживается.",
                reply_markup=get_main_menu()
            )
            await state.clear()
            return
            
    except Exception as e:
        logger.error(f"Ошибка при обработке изображения для подсчета лиц: {e}")
        await message.answer(
            "❌ Ошибка при обработке изображения для подсчета лиц.\n\n"
            "Возможные причины:\n"
            "• Поврежденный файл изображения\n"
            "• Неподдерживаемый формат\n"
            "• Проблемы с обработкой изображения\n"
            "• Файл слишком большой\n\n"
            "Попробуйте отправить другое изображение.",
            reply_markup=get_main_menu()
        )
    
   # await state.clear()

@dp.message(CountFacesState.waiting_for_lecture_number_for_capacity)
async def process_lecture_number(message: types.Message, state: FSMContext):
    """Обработка номера лекции для обновления вместимости"""
    logger.info(f"🔍 ОБРАБОТЧИК НОМЕРА ЛЕКЦИИ ВЫЗВАН!")
    logger.info(f"Пользователь: @{message.from_user.username}")
    logger.info(f"Сообщение: {message.text}")
    logger.info(f"Текущее состояние: {await state.get_state()}")
    
    try:
        lecture_number = int(message.text)
        logger.info(f"✅ Номер лекции успешно распознан: {lecture_number}")
        await state.update_data(lecture_number=lecture_number)
        await state.set_state(CountFacesState.waiting_for_max_students)
        logger.info(f"✅ Переход в состояние waiting_for_max_students")
        await message.answer(
            f"📊 Введите максимальное количество студентов для лекции №{lecture_number}:"
        )
        logger.info(f"✅ Сообщение отправлено пользователю")
    except ValueError:
        logger.warning(f"❌ Некорректный номер лекции: {message.text}")
        await message.answer("❌ Пожалуйста, введите корректный номер лекции (число):")

@dp.message(CountFacesState.waiting_for_max_students)
async def process_max_students(message: types.Message, state: FSMContext):
    """Обработка максимального количества студентов и обновление через API"""
    logger.info(f"Обработка максимального количества студентов от @{message.from_user.username}: {message.text}")
    try:
        max_students = int(message.text)
        if max_students <= 0:
            await message.answer("❌ Количество студентов должно быть положительным числом. Попробуйте еще раз:")
            return
            
        # Получаем данные из состояния
        data = await state.get_data()
        lecture_number = data.get('lecture_number')
        detected_faces = data.get('detected_faces', 0)
        
        logger.info(f"Обновляем вместимость лекции {lecture_number}: max_students={max_students}, detected_faces={detected_faces}")
        
        # Вызываем API для обновления вместимости лекции
        try:
            async with aiohttp.ClientSession() as session:
                capacity_data = {"max_student": max_students}
                
                async with session.put(
                    f"{API_BASE_URL}/lectures/capacity/{lecture_number}",
                    json=capacity_data,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        capacity_info = await response.json()
                        
                        # Формируем отчет об обновлении
                        result_message = "✅ Вместимость лекции успешно обновлена!\n\n"
                        result_message += f"📚 Лекция №{lecture_number}\n"
                        result_message += f"📖 Тема: {capacity_info.get('lecture_topic', 'Не указана')}\n"
                        if capacity_info.get('start_time'):
                            result_message += f"⏰ Время начала: {capacity_info['start_time']}\n"
                        result_message += f"👥 Максимальное количество студентов: {max_students}\n"
                        result_message += f"📊 Текущее количество: {capacity_info.get('current_attendance', 0)}\n"
                        result_message += f"🔍 Обнаружено на фото: {detected_faces} лиц\n\n"
                        
                        # Добавляем информацию о заполненности
                        if capacity_info.get('is_full'):
                            result_message += "❌ Лекция заполнена\n"
                        else:
                            remaining = capacity_info.get('remaining_slots', 0)
                            result_message += f"✅ Свободных мест: {remaining}\n"
                        
                        if capacity_info.get('github_example'):
                            result_message += f"\n🔗 Примеры: {capacity_info.get('github_example')}"
                        
                        await message.answer(result_message, reply_markup=get_main_menu())
                        logger.info(f"Вместимость лекции {lecture_number} успешно обновлена до {max_students}")
                        
                    else:
                        error_text = await response.text()
                        logger.error(f"Ошибка при обновлении вместимости лекции: {response.status} - {error_text}")
                        await message.answer(
                            f"❌ Ошибка при обновлении вместимости лекции №{lecture_number}.\n"
                            f"Статус: {response.status}\n"
                            f"Попробуйте позже или обратитесь к администратору.",
                            reply_markup=get_main_menu()
                        )
                        
        except asyncio.TimeoutError:
            logger.error(f"Таймаут при обновлении вместимости лекции {lecture_number}")
            await message.answer(
                "❌ Превышено время ожидания ответа от сервера. Попробуйте позже.",
                reply_markup=get_main_menu()
            )
        except Exception as e:
            logger.error(f"Ошибка при обновлении вместимости лекции: {e}")
            await message.answer(
                "❌ Не удалось подключиться к серверу. Попробуйте позже.",
                reply_markup=get_main_menu()
            )
            
    except ValueError:
        await message.answer("❌ Пожалуйста, введите корректное количество студентов (положительное число):")
        return
    
    await state.clear()

@dp.message(lambda message: message.text == "Регистрация")
async def registration_start(message: types.Message, state: FSMContext):
    """Начало процесса регистрации"""

    try:
        # Формируем telegram username в едином формате
        telegram_username = message.from_user.username
        if telegram_username:
            telegram = f"@{telegram_username}"
        else:
            telegram = f"user_{message.from_user.id}"
        
        logger.info(f"Проверяю регистрацию для {telegram}")
        
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_BASE_URL}/students/by-telegram/{telegram}", timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    user_info = await response.json()
                    logger.error(f"Получены данные о студенте: {user_info}")
                    if user_info.get('is_deleted'):
                        await message.answer("❌ Ваш аккаунт удален из системы. Пожалуйста, обратитесь к администратору.", reply_markup=get_main_menu())
                        return
                    else:
                        await state.update_data(user=user_info)
                        await message.answer("✅ Вы уже зарегистрированы в системе. Обновите информацию о себе.")
  

    except asyncio.TimeoutError:
        logger.error(f"Таймаут при проверке регистрации для @{message.from_user.username}")
        await message.answer("❌ Превышено время ожидания ответа от сервера. Попробуйте позже.", reply_markup=get_main_menu())
        return
    except Exception as e:
        logger.error(f"Ошибка при получении информации о студенте: {e}")
        await message.answer("❌ Не удалось подключиться к серверу. Попробуйте позже.", reply_markup=get_main_menu())
        return

    await state.set_state(RegistrationStates.waiting_for_name)
    await message.answer(
        "📝 Регистрация студента\n\n"
        "Пожалуйста, введите ваше ФИО (Фамилия Имя Отчество):",
        reply_markup=types.ReplyKeyboardRemove()
    )

@dp.message(RegistrationStates.waiting_for_name)
async def process_name(message: types.Message, state: FSMContext):
    """Обработка введенного имени"""
    await state.update_data(name=message.text)
    await state.set_state(RegistrationStates.waiting_for_github)
    await message.answer(
        "Введите ваш GitHub (например: https://github.com/username):"
    )

@dp.message(RegistrationStates.waiting_for_github)
async def process_github(message: types.Message, state: FSMContext):
    """Обработка введенного GitHub"""
    await state.update_data(github=message.text)
    await state.set_state(RegistrationStates.waiting_for_group)
    await message.answer(
        "Теперь введите номер вашей группы (например: М8О-206Б-24):"
    )

@dp.message(RegistrationStates.waiting_for_group)
async def process_group(message: types.Message, state: FSMContext):
    """Обработка введенной группы"""
    user_info = await state.get_data()
    name = user_info.get('name')
    group = message.text
    github = user_info.get('github')
    user = user_info.get('user')
    
    # Валидация данных перед отправкой
    if not name or len(name.strip()) == 0:
        await message.answer("❌ ФИО не может быть пустым. Пожалуйста, введите ваше ФИО:")
        await state.set_state(RegistrationStates.waiting_for_name)
        return
    
    if not github or len(github.strip()) == 0:
        await message.answer("❌ GitHub не может быть пустым. Пожалуйста, введите ваш GitHub:")
        await state.set_state(RegistrationStates.waiting_for_github)
        return
    
    if not group or len(group.strip()) == 0:
        await message.answer("❌ Номер группы не может быть пустым. Пожалуйста, введите номер группы:")
        await state.set_state(RegistrationStates.waiting_for_group)
        return
    
    # Логирование информации о регистрации
    registration_data = {
        'user_id': message.from_user.id,
        'username': message.from_user.username,
        'name': name,
        'group': group,
        'github': github,
        'timestamp': datetime.now().isoformat()
    }
    
    logger.info(f"Регистрация студента: {json.dumps(registration_data, ensure_ascii=False)}")
    
    try:
        # Формируем telegram username в едином формате
        telegram_username = message.from_user.username
        if telegram_username:
            telegram = f"@{telegram_username}"
        else:
            # Используем chat_id, но сохраняем в едином формате для поиска
            telegram = f"user_{message.from_user.id}"
        
        # Отправляем данные в API
        # Явно проверяем и преобразуем типы данных
        chat_id_value = message.chat.id if message.chat.id else None
        if chat_id_value is not None and not isinstance(chat_id_value, int):
            logger.warning(f"chat_id имеет неожиданный тип: {type(chat_id_value)}, значение: {chat_id_value}")
            chat_id_value = None
        
        student_data = {
            'full_name': str(name.strip()),
            'group_number': str(group.strip()),
            'github': str(github.strip()),
            'telegram': str(telegram),
            'year': int(2),  # Явное преобразование в int
            'chat_id': chat_id_value
        }
        
        # Дополнительная проверка на пустые строки
        if not student_data['full_name'] or not student_data['group_number'] or not student_data['github']:
            await message.answer("❌ Все поля должны быть заполнены. Пожалуйста, начните регистрацию заново.", reply_markup=get_main_menu())
            await state.clear()
            return
        
        # Логируем данные перед отправкой для отладки
        logger.info(f"Отправка данных регистрации: {json.dumps(student_data, ensure_ascii=False, default=str)}")
        logger.info(f"Типы данных: year={type(student_data['year']).__name__}, chat_id={type(student_data['chat_id']).__name__ if student_data['chat_id'] is not None else 'None'}")
        
        async with aiohttp.ClientSession() as session:
            if user:
                # Для PUT запроса не нужно включать id в тело запроса, он передается в URL
                async with session.put(
                    f"{API_BASE_URL}/students/{user.get('id')}",
                    json=student_data,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        updated_student = await response.json()
                        logger.info(f"Студент успешно обновлен в API: {updated_student}")
                        await message.answer(f"✅ Информация о себе успешно обновлена.", reply_markup=get_main_menu())
                        await state.clear()
                        return
                    elif response.status == 422:
                        # Ошибка валидации
                        try:
                            error_data = await response.json()
                            error_detail = error_data.get('detail', 'Ошибка валидации данных')
                            if isinstance(error_detail, list):
                                error_messages = [err.get('msg', str(err)) for err in error_detail]
                                error_detail = ', '.join(error_messages)
                            logger.error(f"Ошибка валидации при обновлении студента: {error_detail}")
                            await message.answer(
                                f"❌ Ошибка валидации: {error_detail}\n\n"
                                f"Пожалуйста, проверьте введенные данные и попробуйте снова.",
                                reply_markup=get_main_menu()
                            )
                        except:
                            error_text = await response.text()
                            logger.error(f"Ошибка валидации при обновлении студента: {error_text}")
                            await message.answer(
                                f"❌ Ошибка валидации данных. Пожалуйста, проверьте введенные данные и попробуйте снова.",
                                reply_markup=get_main_menu()
                            )
                        await state.clear()
                        return
                    elif response.status == 400:
                        # Ошибка запроса (например, дубликат)
                        try:
                            error_data = await response.json()
                            error_detail = error_data.get('detail', 'Некорректный запрос')
                            logger.error(f"Ошибка при обновлении студента: {error_detail}")
                            await message.answer(
                                f"❌ {error_detail}\n\n"
                                f"Пожалуйста, проверьте введенные данные.",
                                reply_markup=get_main_menu()
                            )
                        except:
                            error_text = await response.text()
                            logger.error(f"Ошибка при обновлении студента: {error_text}")
                            await message.answer(
                                f"❌ Ошибка при обновлении информации. Попробуйте позже.",
                                reply_markup=get_main_menu()
                            )
                        await state.clear()
                        return
                    else:
                        error_text = await response.text()
                        logger.error(f"Не удалось обновить студента в API: {response.status} - {error_text}")
                        await message.answer(
                            f"❌ Ошибка при обновлении информации (код: {response.status}). Попробуйте позже или обратитесь к администратору.",
                            reply_markup=get_main_menu()
                        )
                        await state.clear()
                        return
            else:
                async with session.post(
                    f"{API_BASE_URL}/students",
                    json=student_data,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        created_student = await response.json()
                        logger.info(f"Студент успешно зарегистрирован в API: {created_student}")
                        
                        # Сохраняем данные пользователя
                        user_data[message.from_user.id] = {
                            'name': name,
                            'group': group,
                            'github': github,
                            'telegram': student_data['telegram'],
                            'id': created_student.get('id'),
                            'chat_id': message.chat.id
                        }
                        
                        # Генерируем варианты домашних заданий для студента
                        try:
                            logger.info(f"Генерирую варианты ДЗ для студента {created_student.get('id')}")
                            async with session.post(
                                f"{API_BASE_URL}/student-homework-variants/bulk",
                                params={'student_id': created_student.get('id')},
                                timeout=aiohttp.ClientTimeout(total=10)
                            ) as variants_response:
                                if variants_response.status == 200:
                                    variants = await variants_response.json()
                                    logger.info(f"Сгенерировано {len(variants)} вариантов ДЗ для студента {created_student.get('id')}")
                                    
                                    # Получаем информацию о домашних заданиях для отображения номеров
                                    async with session.get(f"{API_BASE_URL}/homework/", timeout=aiohttp.ClientTimeout(total=10)) as homework_response:
                                        homework_dict = {}
                                        if homework_response.status == 200:
                                            homework = await homework_response.json()
                                            for h in homework:
                                                homework_dict[h.get('id')] = h.get('number')
                                        
                                        # Формируем сообщение с вариантами
                                        variants_text = "\n📚 Ваши варианты домашних заданий:\n"
                                        for variant in variants:
                                            homework_number = homework_dict.get(variant.get('homework_id'), 'N/A')
                                            variants_text += f"• Задание №{homework_number} - Вариант {variant.get('variant_number')}\n"
                                        
                                        await message.answer(
                                            f"✅ Регистрация завершена!\n\n"
                                            f"📋 Ваши данные:\n"
                                            f"• ФИО: {name}\n"
                                            f"• Группа: {group}\n"
                                            f"• Telegram: {student_data['telegram']}\n"
                                            f"• GitHub: {github}\n\n"
                                            f"{variants_text}\n"
                                            f"Теперь вы можете использовать все функции бота!",
                                            reply_markup=get_main_menu()
                                        )
                                else:
                                    logger.warning(f"Не удалось сгенерировать варианты ДЗ: {variants_response.status}")
                                    await message.answer(
                                        f"✅ Регистрация завершена!\n\n"
                                        f"📋 Ваши данные:\n"
                                        f"• ФИО: {name}\n"
                                        f"• Группа: {group}\n"
                                        f"• Telegram: {student_data['telegram']}\n"
                                        f"• GitHub: {github}\n\n"
                                        f"Теперь вы можете использовать все функции бота!",
                                        reply_markup=get_main_menu()
                                    )
                        except Exception as e:
                            logger.error(f"Ошибка при генерации вариантов ДЗ: {e}")
                            await message.answer(
                                f"✅ Регистрация завершена!\n\n"
                                f"📋 Ваши данные:\n"
                                f"• ФИО: {name}\n"
                                f"• Группа: {group}\n"
                                f"• Telegram: {student_data['telegram']}\n"
                                f"• GitHub: {github}\n\n"
                                f"Теперь вы можете использовать все функции бота!",
                                reply_markup=get_main_menu()
                            )
                    elif response.status == 422:
                        # Ошибка валидации
                        try:
                            error_data = await response.json()
                            error_detail = error_data.get('detail', 'Ошибка валидации данных')
                            
                            # Логируем полную информацию об ошибке для отладки
                            logger.error(f"422 Validation Error: {json.dumps(error_data, ensure_ascii=False, indent=2)}")
                            logger.error(f"Отправленные данные: {json.dumps(student_data, ensure_ascii=False, default=str)}")
                            
                            # Формируем понятное сообщение для пользователя
                            if isinstance(error_detail, list):
                                error_messages = []
                                for err in error_detail:
                                    field_path = '.'.join(str(loc) for loc in err.get('loc', []))
                                    msg = err.get('msg', str(err))
                                    error_type = err.get('type', 'unknown')
                                    error_messages.append(f"• {field_path}: {msg} (тип: {error_type})")
                                error_detail = '\n'.join(error_messages)
                            
                            logger.error(f"Ошибка валидации при регистрации: {error_detail}")
                            await message.answer(
                                f"❌ Ошибка валидации данных:\n\n{error_detail}\n\n"
                                f"Пожалуйста, проверьте введенные данные и попробуйте снова.",
                                reply_markup=get_main_menu()
                            )
                        except Exception as e:
                            error_text = await response.text()
                            logger.error(f"Ошибка при обработке 422: {e}")
                            logger.error(f"Ответ сервера: {error_text}")
                            logger.error(f"Отправленные данные: {json.dumps(student_data, ensure_ascii=False, default=str)}")
                            await message.answer(
                                f"❌ Ошибка валидации данных. Попробуйте снова или обратитесь к администратору.",
                                reply_markup=get_main_menu()
                            )
                    elif response.status == 400:
                        # Ошибка запроса (например, дубликат)
                        try:
                            error_data = await response.json()
                            error_detail = error_data.get('detail', 'Некорректный запрос')
                            logger.error(f"Ошибка при регистрации: {error_detail}")
                            if 'already exists' in error_detail.lower() or 'duplicate' in error_detail.lower():
                                await message.answer(
                                    f"❌ {error_detail}\n\n"
                                    f"Возможно, вы уже зарегистрированы в системе. Попробуйте использовать команду /start для проверки.",
                                    reply_markup=get_main_menu()
                                )
                            else:
                                await message.answer(
                                    f"❌ {error_detail}\n\n"
                                    f"Пожалуйста, проверьте введенные данные и попробуйте снова.",
                                    reply_markup=get_main_menu()
                                )
                        except:
                            error_text = await response.text()
                            logger.error(f"Ошибка при регистрации: {error_text}")
                            await message.answer(
                                f"❌ Ошибка при регистрации. Возможно, вы уже зарегистрированы. Попробуйте использовать команду /start.",
                                reply_markup=get_main_menu()
                            )
                    else:
                        # Другие ошибки (500, 503, и т.д.)
                        error_text = await response.text()
                        logger.error(f"Ошибка при регистрации в API: {response.status} - {error_text}")
                        await message.answer(
                            f"❌ Ошибка при регистрации в системе (код: {response.status}). "
                            f"Попробуйте позже или обратитесь к администратору.",
                            reply_markup=get_main_menu()
                        )
                    
    except asyncio.TimeoutError:
        logger.error(f"Таймаут при регистрации студента")
        await message.answer("❌ Превышено время ожидания ответа от сервера. Попробуйте позже.", reply_markup=get_main_menu())
    except Exception as e:
        logger.error(f"Ошибка при регистрации студента: {e}")
        await message.answer("❌ Не удалось подключиться к серверу. Попробуйте позже.", reply_markup=get_main_menu())
    
    await state.clear()

@dp.message(lambda message: message.text == "Check-in на лекции")
async def checkin_start(message: types.Message, state: FSMContext):
    """Начало процесса check-in"""
    await state.set_state(CheckInStates.waiting_for_qr_photo)
    await message.answer(
        "📸 Check-in на лекцию\n\n"
        "Пожалуйста, отправьте фотографию с QR-кодом лекции:",
        reply_markup=types.ReplyKeyboardRemove()
        )


@dp.message(CheckInStates.waiting_for_qr_photo, F.content_type == "photo")
async def process_qr_photo(message: types.Message, state: FSMContext):
    """Обработка фотографии с QR-кодом"""
    try:
        # Получаем файл фотографии
        photo = message.photo[-1]  # Берем самое большое разрешение
        file = await bot.get_file(photo.file_id)
        
        # Скачиваем фотографию
        photo_bytes = await bot.download_file(file.file_path)
        
        # Открываем изображение
        image = Image.open(photo_bytes)

        # получаем содержимое QR Code в image с помощью qrcode
        # Преобразуем изображение PIL в массив numpy для OpenCV
        image_np = np.array(image.convert('RGB'))
        # OpenCV использует BGR, а не RGB
        image_cv = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

        # Инициализируем детектор QR-кода
        detector = cv2.QRCodeDetector()
        data, points, _ = detector.detectAndDecode(image_cv)

        if not data:
            await message.answer("❌ Не удалось распознать QR-код на фото. Попробуйте еще раз.", reply_markup=get_main_menu())
            await state.clear()
            return

        qr_content = data  # строка с содержимым QR-кода
        # await message.answer( f"QRCode {qr_content}\n\n",
        #                         reply_markup=get_main_menu()
        #                     )
        try:
            # Получаем информацию о студенте
            # Формируем telegram username в едином формате (как в регистрации)
            telegram_username = message.from_user.username
            if telegram_username:
                user_telegram = f"@{telegram_username}"
            else:
                user_telegram = f"user_{message.from_user.id}"
        
            async with aiohttp.ClientSession() as session:
                # Получаем студента по Telegram
                async with session.get(f"{API_BASE_URL}/students/by-telegram/{user_telegram}", timeout=aiohttp.ClientTimeout(total=10)) as student_response:
                    if student_response.status != 200:
                        await message.answer("❌ Сначала необходимо зарегистрироваться в системе.", reply_markup=get_main_menu())
                        await state.clear()
                        return
                    
                    student = await student_response.json()
                    
                    # Отправляем домашнее задание в API
                    checkin_data = {
                        'qr_code': qr_content,
                        'send_date': datetime.now().isoformat(),
                        "chat_id": message.chat.id,
                        "student": {
                                    "student_id" : student["id"],
                                    "telegram": user_telegram
                                }
                        }
                    
                    async with session.post(
                        f"{N8N_BASE_URL}/webhook/checkin",
                        json=checkin_data,
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as response:
                        if response.status == 200:
                            created_checkin = await response.json()
                            
                            await message.answer(
                                f"✅ Запрос на регистрацию отправлен!\n\n",
                                reply_markup=get_main_menu()
                            )
                        else:
                            error_text = await response.text()
                            logger.error(f"Ошибка при отправке регистрации в API: {response.status} - {error_text}")
                            await message.answer(
                                f"❌ Ошибка при отправке регистрации. Попробуйте позже.",
                                reply_markup=get_main_menu()
                            )                      
        except asyncio.TimeoutError:
            logger.error(f"Таймаут при отправке домашнего задания")
            await message.answer("❌ Превышено время ожидания ответа от сервера. Попробуйте позже.", reply_markup=get_main_menu())
        except Exception as e:
            logger.error(f"Ошибка при отправке домашнего задания: {e}")
            await message.answer("❌ Не удалось подключиться к серверу. Попробуйте позже.", reply_markup=get_main_menu())
            
    except Exception as e:
        logger.error(f"Ошибка при обработке QR-кода: {e}")
        await message.answer(
            "❌ Ошибка при обработке QR-кода. Попробуйте еще раз.",
            reply_markup=get_main_menu()
        )
    
    await state.clear()

@dp.message(lambda message: message.text == "Отправка домашнего задания")
async def homework_start(message: types.Message, state: FSMContext):
    """Начало процесса отправки домашнего задания"""
    await state.set_state(HomeworkStates.waiting_for_number)
    await message.answer(
        "📚 Отправка домашнего задания\n\n"
        "Введите номер домашнего задания:",
        reply_markup=types.ReplyKeyboardRemove()
    )

@dp.message(HomeworkStates.waiting_for_number)
async def process_homework_number(message: types.Message, state: FSMContext):
    """Обработка номера домашнего задания"""
    try:
        number = int(message.text)
        await state.update_data(homework_number=number)
        await state.set_state(HomeworkStates.waiting_for_repo)
        await message.answer(
            f"Введите ссылку на репозиторий (GitHub):"
        )
    except ValueError:
        await message.answer("❌ Пожалуйста, введите корректный номер задания (число):")

@dp.message(HomeworkStates.waiting_for_repo)
async def process_homework_repo(message: types.Message, state: FSMContext):
    """Обработка ссылки на репозиторий"""
    repo_url = message.text
    await state.update_data(repo_url=repo_url)
    await state.set_state(HomeworkStates.waiting_for_comment)
    await message.answer(
        "Введите комментарий для преподавателя (или отправьте '-' если комментарий не нужен):"
    )

@dp.message(HomeworkStates.waiting_for_comment)
async def process_homework_comment(message: types.Message, state: FSMContext):
    """Обработка комментария к домашнему заданию"""
    comment = message.text if message.text != '-' else ""
    homework_data = await state.get_data()
    
    # Формируем данные для логирования
    homework_info = {
        'user_id': message.from_user.id,
        'username': message.from_user.username,
        'homework_number': homework_data.get('homework_number'),
        'repo_url': homework_data.get('repo_url'),
        'comment': comment,
        'timestamp': datetime.now().isoformat()
    }
    
    logger.info(f"Отправка домашнего задания: {json.dumps(homework_info, ensure_ascii=False)}")
    
    try:
        # Получаем информацию о студенте
        # Формируем telegram username в едином формате (как в регистрации)
        telegram_username = message.from_user.username
        if telegram_username:
            user_telegram = f"@{telegram_username}"
        else:
            user_telegram = f"user_{message.from_user.id}"
        
        async with aiohttp.ClientSession() as session:
            # Получаем студента по Telegram
            async with session.get(f"{API_BASE_URL}/students/by-telegram/{user_telegram}", timeout=aiohttp.ClientTimeout(total=10)) as student_response:
                if student_response.status != 200:
                    await message.answer("❌ Сначала необходимо зарегистрироваться в системе.", reply_markup=get_main_menu())
                    await state.clear()
                    return
                
                student = await student_response.json()
                
                # Отправляем домашнее задание в API
                homework_review_data = {
                    'number': homework_data.get('homework_number'),
                    'send_date': datetime.now().isoformat(),
                    'url': homework_data.get('repo_url'),
                    'comments': comment,
                    "chat_id": message.chat.id,
                    "student": {
                                "telegram": user_telegram
                            }
                    }
                
                async with session.post(
                    f"{N8N_BASE_URL}/webhook/homework-submission",
                    json=homework_review_data,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        created_review = await response.json()
                        logger.info(f"Домашнее задание успешно отправлено в API: {created_review}")
                        
                        await message.answer(
                            f"✅ Домашнее задание отправлено!\n\n"
                            f"📋 Информация о задании:\n"
                            f"• Номер: {homework_data.get('homework_number')}\n"
                            f"• Репозиторий: {homework_data.get('repo_url')}\n"
                            f"• Комментарий: {comment if comment else 'Не указан'}\n"
                            f"• Время отправки: {datetime.now().strftime('%d.%m.%Y %H:%M')}\n\n"
                            f"Ваше задание будет проверено преподавателем.",
                            reply_markup=get_main_menu()
                        )
                    else:
                        error_text = await response.text()
                        logger.error(f"Ошибка при отправке домашнего задания в API: {response.status} - {error_text}")
                        await message.answer(
                            f"❌ Ошибка при отправке домашнего задания. Попробуйте позже.",
                            reply_markup=get_main_menu()
                        )
                        
    except asyncio.TimeoutError:
        logger.error(f"Таймаут при отправке домашнего задания")
        await message.answer("❌ Превышено время ожидания ответа от сервера. Попробуйте позже.", reply_markup=get_main_menu())
    except Exception as e:
        logger.error(f"Ошибка при отправке домашнего задания: {e}")
        await message.answer("❌ Не удалось подключиться к серверу. Попробуйте позже.", reply_markup=get_main_menu())
    
    await state.clear()

@dp.message(lambda message: message.text == "Получение расписания лекций")
async def get_lectures_schedule(message: types.Message):
    """Получение расписания лекций из API"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_BASE_URL}/lectures", timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    lectures = await response.json()
                    
                    if not lectures:
                        await message.answer("📅 Расписание лекций пусто.", reply_markup=get_main_menu())
                        return
                    
                    schedule_text = "📅 Расписание лекций:\n\n"
                    for lecture in lectures:
                        date = datetime.fromisoformat(lecture['date'].replace('Z', '+00:00')).strftime('%d.%m.%Y')
                        schedule_text += f"📚 Лекция №{lecture['number']}\n"
                        schedule_text += f"   Тема: {lecture['topic']}\n"
                        schedule_text += f"   Дата: {date}\n"
                        if lecture.get('start_time'):
                            schedule_text += f"   ⏰ Время начала: {lecture['start_time']}\n"
                        schedule_text += "\n"
                    
                    await message.answer(schedule_text, reply_markup=get_main_menu())
                    
                else:
                    await message.answer("❌ Ошибка при получении расписания лекций.", reply_markup=get_main_menu())
                    
    except asyncio.TimeoutError:
        logger.error(f"Таймаут при получении расписания лекций")
        await message.answer("❌ Превышено время ожидания ответа от сервера. Попробуйте позже.", reply_markup=get_main_menu())
    except Exception as e:
        logger.error(f"Ошибка при запросе к API лекций: {e}")
        await message.answer("❌ Не удалось подключиться к серверу. Попробуйте позже.", reply_markup=get_main_menu())

@dp.message(lambda message: message.text == "Информация о домашних заданиях")
async def get_homework_info(message: types.Message):
    """Получение информации о домашних заданиях студента"""
    try:
        # Формируем telegram username в едином формате (как в регистрации)
        telegram_username = message.from_user.username
        if telegram_username:
            user_telegram = f"@{telegram_username}"
        else:
            user_telegram = f"user_{message.from_user.id}"
        
        async with aiohttp.ClientSession() as session:
            # Получаем информацию о студенте
            async with session.get(f"{API_BASE_URL}/students/by-telegram/{user_telegram}", timeout=aiohttp.ClientTimeout(total=10)) as student_response:
                if student_response.status != 200:
                    await message.answer("❌ Сначала необходимо зарегистрироваться в системе.", reply_markup=get_main_menu())
                    return
                
                student = await student_response.json()
                student_id = student.get('id')
                
                # Получаем варианты домашних заданий для студента
                async with session.get(f"{API_BASE_URL}/student-homework-variants/student/{student_id}", timeout=aiohttp.ClientTimeout(total=10)) as variants_response:
                    if variants_response.status != 200:
                        await message.answer("❌ Не удалось получить информацию о домашних заданиях.", reply_markup=get_main_menu())
                        return
                    
                    variants = await variants_response.json()
                    
                    if not variants:
                        await message.answer("📚 У вас пока нет назначенных домашних заданий.", reply_markup=get_main_menu())
                        return
                    
                    # Получаем информацию о всех домашних заданиях
                    async with session.get(f"{API_BASE_URL}/homework/", timeout=aiohttp.ClientTimeout(total=10)) as homework_response:
                        if homework_response.status != 200:
                            await message.answer("❌ Не удалось получить информацию о домашних заданиях.", reply_markup=get_main_menu())
                            return
                        
                        homework_list = await homework_response.json()
                        
                        # Создаем словарь для быстрого поиска домашних заданий
                        homework_dict = {h.get('id'): h for h in homework_list}
                        
                        # Формируем сообщение с информацией о домашних заданиях
                        homework_text = f"📚 Ваши домашние задания:\n\n"
                        
                        for variant in variants:
                            homework_id = variant.get('homework_id')
                            variant_number = variant.get('variant_number')
                            
                            if homework_id in homework_dict:
                                homework = homework_dict[homework_id]
                                
                                # Форматируем дату сдачи
                                due_date_obj = datetime.fromisoformat(homework['due_date'].replace('Z', '+00:00'))
                                due_date_str = due_date_obj.strftime('%d.%m.%Y')
                                
                                # Проверяем, просрочено ли задание
                                current_date = datetime.now()
                                is_overdue = current_date > due_date_obj
                                status_icon = "🔴" if is_overdue else "🟢"
                                status_text = " (ПРОСРОЧЕНО)" if is_overdue else ""
                                
                                homework_text += f"📝 Задание №{homework['number']}\n"
                                homework_text += f"   📖 Название: {homework['short_description']}\n"
                                homework_text += f"   📅 Срок сдачи: {due_date_str}{status_text}\n"
                                homework_text += f"   🔢 Ваш вариант: {variant_number}\n"
                                
                                # Добавляем дату назначения, если доступна
                                if homework.get('assigned_date'):
                                    assigned_date = datetime.fromisoformat(homework['assigned_date'].replace('Z', '+00:00')).strftime('%d.%m.%Y')
                                    homework_text += f"   📋 Назначено: {assigned_date}\n"
                                
                                if homework.get('example_link'):
                                    homework_text += f"   🔗 Задание: {homework['example_link']}\n"
                                
                                homework_text += "\n"
                        
                        await message.answer(homework_text, reply_markup=get_main_menu())
                        
    except asyncio.TimeoutError:
        logger.error(f"Таймаут при получении информации о домашних заданиях")
        await message.answer("❌ Превышено время ожидания ответа от сервера. Попробуйте позже.", reply_markup=get_main_menu())
    except Exception as e:
        logger.error(f"Ошибка при получении информации о домашних заданиях: {e}")
        await message.answer("❌ Не удалось подключиться к серверу. Попробуйте позже.", reply_markup=get_main_menu())

@dp.message(lambda message: message.text == "Получение информации о успеваемости")
async def get_academic_performance(message: types.Message):
    """Получение информации об успеваемости студента"""
    try:
        # Формируем telegram username в едином формате (как в регистрации)
        telegram_username = message.from_user.username
        if telegram_username:
            user_telegram = f"@{telegram_username}"
        else:
            user_telegram = f"user_{message.from_user.id}"
        
        async with aiohttp.ClientSession() as session:
            # Получаем все работы на проверку
            async with session.get(f"{API_BASE_URL}/homework_review/by-telegram/{user_telegram}", timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    reviews = await response.json()
                    logger.info(f"Получены данные об успеваемости для {user_telegram}: {len(reviews)} записей")
                    
                    # Ищем работы текущего пользователя
                    user_reviews = [r for r in reviews if r.get('student', {}).get('telegram') == user_telegram]
                    logger.info(f"Найдено {len(user_reviews)} работ для пользователя {user_telegram}")
                    
                    if not user_reviews:
                        await message.answer(
                            "📊 Информация об успеваемости\n\n"
                            "У вас пока нет оцененных работ. "
                            "Отправьте домашнее задание, чтобы увидеть результаты.",
                            reply_markup=get_main_menu()
                        )
                        return
                    
                    performance_text = f"📊 Успеваемость студента {user_telegram}:\n\n"
                    
                    for review in user_reviews:
                        student = review.get('student', {})
                        
                        # Логируем проблемные данные для отладки
                        logger.info(f"Обрабатываем review: send_date={review.get('send_date')} (тип: {type(review.get('send_date'))}), review_date={review.get('review_date')} (тип: {type(review.get('review_date'))})")
                        
                        # Безопасный парсинг даты отправки
                        send_date_str = 'Неизвестно'
                        if review.get('send_date'):
                            if isinstance(review['send_date'], str):
                                try:
                                    send_date_str = datetime.fromisoformat(review['send_date'].replace('Z', '+00:00')).strftime('%d.%m.%Y')
                                except ValueError:
                                    send_date_str = 'Неверный формат даты'
                            else:
                                send_date_str = 'Неверный тип даты'
                        
                        # Безопасный парсинг даты проверки
                        review_date_str = 'Не проверено'
                        if review.get('review_date'):
                            if isinstance(review['review_date'], str):
                                try:
                                    review_date_str = datetime.fromisoformat(review['review_date'].replace('Z', '+00:00')).strftime('%d.%m.%Y')
                                except ValueError:
                                    review_date_str = 'Неверный формат даты'
                            else:
                                review_date_str = 'Неверный тип даты'
                        
                        performance_text += f"📚 Задание №{review['number']}\n"
                        performance_text += f"   📅 Дата отправки: {send_date_str}\n"
                        performance_text += f"   🔗 Github: {review['url']}\n"
                        performance_text += f"   📊 Оценка: {review['result']}/15\n"
                        
                        if review.get('ai_percentage') is not None:
                            ai_level = "🔴 Высокий" if review['ai_percentage'] > 70 else "🟡 Средний" if review['ai_percentage'] > 30 else "🟢 Низкий"
                            performance_text += f"   🤖 Уровень AI: {review['ai_percentage']}% ({ai_level})\n"
                        
                        if review.get('comments'):
                            performance_text += f"   💬 Комментарий: {review['comments']}\n"
                        
                        performance_text += "\n"
                    
                    await message.answer(performance_text, reply_markup=get_main_menu())
                    
                else:
                    await message.answer("❌ Ошибка при получении информации об успеваемости.", reply_markup=get_main_menu())
                    
    except asyncio.TimeoutError:
        logger.error(f"Таймаут при получении информации об успеваемости")
        await message.answer("❌ Превышено время ожидания ответа от сервера. Попробуйте позже.", reply_markup=get_main_menu())
    except Exception as e:
        logger.error(f"Ошибка при запросе к API успеваемости: {e}")
        await message.answer("❌ Не удалось подключиться к серверу. Попробуйте позже.", reply_markup=get_main_menu())

@dp.message(lambda message: message.text == "Проверка вместимости лекции")
async def lecture_capacity_start(message: types.Message, state: FSMContext):
    """Начало процесса проверки вместимости лекции"""
    await state.set_state(LectureMaterialsStates.waiting_for_lecture_number)
    await message.answer(
        "👥 Проверка вместимости лекции\n\n"
        "Введите номер лекции для проверки количества студентов:",
        reply_markup=types.ReplyKeyboardRemove()
    )

@dp.message(lambda message: message.text == "Получение материалов лекций")
async def lecture_materials_start(message: types.Message, state: FSMContext):
    """Начало процесса получения материалов лекций"""
    await state.set_state(LectureMaterialsStates.waiting_for_lecture_number)
    await message.answer(
        "📖 Материалы лекций\n\n"
        "Введите номер лекции для получения материалов:",
        reply_markup=types.ReplyKeyboardRemove()
    )

@dp.message(LectureMaterialsStates.waiting_for_lecture_number)
async def process_lecture_materials(message: types.Message, state: FSMContext):
    """Обработка номера лекции и отправка материалов или проверка вместимости"""
    try:
        lecture_number = int(message.text)
        
        # Сначала проверяем вместимость лекции
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{API_BASE_URL}/lectures/capacity/{lecture_number}", timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        capacity_data = await response.json()
                        
                        capacity_text = f"👥 Вместимость лекции №{lecture_number}\n\n"
                        capacity_text += f"📚 Тема: {capacity_data['lecture_topic']}\n"
                        if capacity_data.get('start_time'):
                            capacity_text += f"⏰ Время начала: {capacity_data['start_time']}\n"
                        capacity_text += f"👨‍🎓 Текущее количество: {capacity_data['current_attendance']} студентов\n"
                        
                        if capacity_data['max_student'] is not None:
                            capacity_text += f"🔢 Максимальное количество: {capacity_data['max_student']} студентов\n"
                            capacity_text += f"📊 Заполненность: {round((capacity_data['current_attendance'] / capacity_data['max_student']) * 100)}%\n"
                            
                            if capacity_data['is_full']:
                                capacity_text += "❌ Лекция заполнена\n"
                            else:
                                capacity_text += f"✅ Свободных мест: {capacity_data['remaining_slots']}\n"
                        else:
                            capacity_text += "♾️ Без ограничений по количеству студентов\n"
                        
                        capacity_text += f"🔗 Примеры: {capacity_data['github_example']}\n"
                        await message.answer(capacity_text)
                    else:
                        await message.answer(f"❌ Лекция №{lecture_number} не найдена.", reply_markup=get_main_menu())
                        await state.clear()
                        return
                        
        except Exception as e:
            logger.error(f"Ошибка при проверке вместимости лекции: {e}")
            await message.answer("❌ Ошибка при проверке вместимости лекции.", reply_markup=get_main_menu())
        
        # Затем отправляем материалы лекции через API
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{API_BASE_URL}/lectures/by-number/{lecture_number}/presentation", timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status == 200:
                        # Получаем содержимое файла
                        file_content = await response.read()
                        
                        # Определяем имя файла из заголовков или используем стандартное
                        content_disposition = response.headers.get('Content-Disposition', '')
                        filename = f"lecture_{lecture_number}_presentation.pdf"
                        if 'filename=' in content_disposition:
                            filename = content_disposition.split('filename=')[1].strip('"')
                        
                        # Отправляем файл
                        await message.answer_document(
                            types.BufferedInputFile(
                                file_content,
                                filename=filename
                            ),
                            caption=f"📖 Материалы лекции №{lecture_number}"
                        )
                        
                        logger.info(f"Отправлены материалы лекции {lecture_number} пользователю {message.from_user.id}")
                    elif response.status == 404:
                        await message.answer(
                            f"📝 Материалы для лекции №{lecture_number} не найдены.\n"
                            f"Пожалуйста, обратитесь к преподавателю.",
                            reply_markup=get_main_menu()
                        )
                    else:
                        await message.answer(
                            f"❌ Ошибка при получении материалов лекции №{lecture_number}.",
                            reply_markup=get_main_menu()
                        )
        except Exception as e:
            logger.error(f"Ошибка при получении материалов лекции: {e}")
            await message.answer(
                f"❌ Ошибка при получении материалов лекции №{lecture_number}.",
                reply_markup=get_main_menu()
            )
        
        await message.answer("Выберите следующее действие:", reply_markup=get_main_menu())
        
    except ValueError:
        await message.answer("❌ Пожалуйста, введите корректный номер лекции (число):")
        return
    
    await state.clear()

# Универсальный обработчик удален для упрощения логики
# Теперь все сообщения обрабатываются только специфическими обработчиками

async def main():
    """Главная функция запуска бота"""
    logger.info("Запуск Telegram бота...")
    
    # Проверка на конфликт с другими экземплярами бота
    try:
        # Пытаемся получить информацию о боте для проверки доступности API
        bot_info = await bot.get_me()
        logger.info(f"Бот подключен: @{bot_info.username} ({bot_info.first_name})")
    except Exception as e:
        logger.error(f"Ошибка при подключении к Telegram API: {e}")
        logger.error("Возможные причины:")
        logger.error("1. Неверный BOT_TOKEN")
        logger.error("2. Другой экземпляр бота уже запущен (конфликт getUpdates)")
        logger.error("3. Проблемы с сетью")
        logger.error("")
        logger.error("Для проверки запущенных экземпляров выполните:")
        logger.error("  cd bot && bash check_bot_processes.sh")
        logger.error("Для остановки всех экземпляров выполните:")
        logger.error("  cd bot && bash stop_all_bots.sh")
        raise
    
    # Логируем конфигурацию
    logger.info(f"Конфигурация бота:")
    logger.info(f"  BOT_TOKEN: {'*' * len(BOT_TOKEN) if BOT_TOKEN else 'НЕ УСТАНОВЛЕН'}")
    logger.info(f"  API_BASE_URL: {API_BASE_URL}")
    logger.info(f"  N8N_BASE_URL: {N8N_BASE_URL}")
    
    # # Создаем папку resources если её нет
    # os.makedirs("resources", exist_ok=True)
    
    # # Создаем тестовые файлы лекций
    # for i in range(1, 6):
    #     filename = f"resources/lecture_{i}.txt"
    #     if not os.path.exists(filename):
    #         with open(filename, 'w', encoding='utf-8') as f:
    #             f.write(f"Материалы лекции №{i}\n\n")
    #             f.write(f"Тема: Введение в предмет (лекция {i})\n")
    #             f.write(f"Дата: {datetime.now().strftime('%d.%m.%Y')}\n\n")
    #             f.write("Содержание лекции:\n")
    #             f.write("1. Основные понятия\n")
    #             f.write("2. Теоретические основы\n")
    #             f.write("3. Практические примеры\n")
    #             f.write("4. Домашнее задание\n\n")
    #             f.write("Дополнительные материалы и ссылки будут предоставлены на следующей лекции.")
    
    # Запускаем бота с обработкой ошибок конфликта
    try:
        await dp.start_polling(bot)
    except Exception as e:
        error_msg = str(e)
        if "Conflict" in error_msg or "getUpdates" in error_msg:
            logger.error("=" * 60)
            logger.error("ОШИБКА: Обнаружен конфликт с другим экземпляром бота!")
            logger.error("=" * 60)
            logger.error("Другой экземпляр бота уже запущен и получает обновления.")
            logger.error("")
            logger.error("Для решения проблемы выполните:")
            logger.error("1. cd bot")
            logger.error("2. bash check_bot_processes.sh  # проверка запущенных экземпляров")
            logger.error("3. bash stop_all_bots.sh        # остановка всех экземпляров")
            logger.error("4. Затем запустите бота заново")
            logger.error("=" * 60)
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Бот остановлен пользователем")
    except Exception as e:
        logger.error(f"Критическая ошибка при запуске бота: {e}", exc_info=True)
        exit(1)
