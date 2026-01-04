# Python base image
FROM python:3.9-slim

# System updates aur Node.js install karo
# (Kyunki script ko 'node' command chahiye Kwik decrypt karne ke liye)
RUN apt-get update && \
    apt-get install -y nodejs npm && \
    apt-get clean

# Working directory
WORKDIR /app

# Python dependencies install karo
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code copy karo
COPY . .

# Port set karo
ENV PORT=10000
EXPOSE 10000

# Start Command (Uvicorn server chalayega)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]
