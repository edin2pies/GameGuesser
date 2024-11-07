# app.py

from flask import Flask, render_template, jsonify, request, session, redirect, url_for, send_from_directory, flash
import random
import mysql.connector
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/start_game', methods=['POST'])
def start_game():
    # Retrieve selected options from the form
    selected_game = request.form.get('game')
    selected_difficulty = request.form.get('difficulty')
    
    # Store the selected options in session or pass to template
    session['selected_game'] = selected_game
    session['selected_difficulty'] = selected_difficulty

    # Redirect to the guessing game page with the options
    return redirect(url_for('guessing_game'))

def create_connection():
    return mysql.connector.connect(
        host=os.getenv('DATABASE_HOST', 'localhost'),  # Use 'localhost' if not specified
        user=os.getenv('DATABASE_USER'),
        password=os.getenv('DATABASE_PASSWORD'),
        database=os.getenv('DATABASE_NAME')
    )

@app.route('/guessing_game')
def guessing_game():
    # Pass selected options from session to guessing game template
    selected_game = session.get('selected_game', 'Unknown Game')
    selected_difficulty = session.get('selected_difficulty', 'Unknown Difficulty')
    
    return render_template('guessing_game.html', selected_game=selected_game, selected_difficulty=selected_difficulty)

# User registration route
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        # Hash the password
        hashed_password = generate_password_hash(password)

        conn = create_connection()
        c = conn.cursor()
        try:
            # Insert the new user into the users table
            c.execute("INSERT INTO users (username, password) VALUES (%s, %s)", (username, hashed_password))
            conn.commit()
            conn.close()
            flash("Registration successful! Please log in.")
            return redirect(url_for('login'))
        except mysql.connector.IntegrityError:
            flash("Username already exists. Please choose another one.")
            return redirect(url_for('register'))
    return render_template('register.html')

# User login route
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        conn = create_connection()
        c = conn.cursor()
        c.execute("SELECT user_id, password FROM users WHERE username = %s", (username,))
        user = c.fetchone()
        conn.close()

        if user and check_password_hash(user[1], password):
            # Set user session
            session['user_id'] = user[0]
            session['username'] = username
            flash("Login successful!")
            return redirect(url_for('home'))
        else:
            flash("Invalid credentials. Please try again.")
            return redirect(url_for('login'))
    return render_template('login.html')
    
# User logout route
@app.route('/logout')
def logout():
    session.clear()
    flash("You have been logged out.")
    return redirect(url_for('home'))

# Function to get a random map from the database
def get_random_map():
    conn = create_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM maps ORDER BY RAND() LIMIT 1")  # MySQL: "ORDER BY RAND()"
    map_data = c.fetchone()
    conn.close()
    if map_data:
        return {"id": map_data[0], "image_path": map_data[3]}
    return None

# Route to serve images from the images directory
@app.route('/images/<path:filename>')
def images(filename):
    return send_from_directory('images', filename)

# Route to get a random image
@app.route('/get_image', methods=['GET'])
def get_image():
    # Check if the image queue exists and is not empty
    if 'image_queue' not in session or not session['image_queue']:
        # If the queue is empty or doesn't exist, return game over
        return jsonify({"game_over": True, "message": "Game over! No more images."})

    # Get the next image ID from the queue
    image_queue = session['image_queue']
    image_id = image_queue.pop(0)  # Pop the first image ID
    session['image_queue'] = image_queue  # Update the queue in the session

    # Retrieve the image data for the selected image ID
    conn = create_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM maps WHERE id = %s", (image_id,))
    map_data = c.fetchone()
    conn.close()

    if map_data:
        return jsonify({
            "id": map_data[0],
            "image_path": map_data[3],
            "game_over": False
        })
    else:
        return jsonify({"error": "Image not found."}), 404

# Route to submit a guess
@app.route('/submit_answer', methods=['POST'])
def submit_answer():
    # Check if the user is logged in by verifying 'user_id' in session
    if 'user_id' not in session:
        return jsonify({"result": "not_logged_in", "message": "Please log in to submit an answer."}), 401

    data = request.json
    map_id = data.get("id")
    game_guess = data.get("game_name").strip().lower()
    map_guess = data.get("map_name").strip().lower()
    score = data.get("score", 0)
    user_id = session['user_id']  # Retrieve the user_id from the session

    conn = create_connection()
    c = conn.cursor()
    
    # Check if the answer is correct
    c.execute("SELECT game_name, map_name FROM maps WHERE id = %s", (map_id,))
    correct_data = c.fetchone()

    if correct_data:
        correct_game, correct_map = correct_data
        if game_guess == correct_game.lower() and map_guess == correct_map.lower():
            # Insert the score into the scores table with user_id
            c.execute("INSERT INTO scores (map_id, score, user_id, timestamp) VALUES (%s, %s, %s, %s)",
                      (map_id, score, user_id, datetime.now()))
            conn.commit()
            conn.close()
            return jsonify({"result": "correct", "score": score})
    
    conn.close()
    return jsonify({"result": "incorrect"})


@app.route('/leaderboard')
def leaderboard():
    conn = create_connection()
    c = conn.cursor()
    
    # Query for top scores
    c.execute("""
        SELECT u.username, s.score, s.timestamp
        FROM scores s
        JOIN users u ON s.user_id = u.user_id
        ORDER BY s.score DESC
        LIMIT 10
    """)
    
    top_scores = c.fetchall()
    conn.close()

    # Render leaderboard HTML page and pass top scores
    return render_template('leaderboard.html', top_scores=top_scores)

@app.route('/reset_game', methods=['POST'])
def reset_game():
    # Fetch all image IDs from the database
    conn = create_connection()
    c = conn.cursor()
    c.execute("SELECT id FROM maps")
    all_image_ids = [row[0] for row in c.fetchall()]
    conn.close()

    # Shuffle and store the queue in the session
    random.shuffle(all_image_ids)
    session['image_queue'] = all_image_ids  # Initialize a new shuffled queue

    return jsonify({"message": "Game reset successfully. Starting a new game!"})

if __name__ == '__main__':
    app.run(debug=True)
