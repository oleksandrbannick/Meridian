"""
Example configuration file
Copy this to config.py and add your credentials
DO NOT commit config.py to git!
"""

# Kalshi API Configuration
API_KEY_ID = "your-api-key-id-here"
PRIVATE_KEY_PATH = "path/to/your/private-key.pem"

# Environment
USE_DEMO = True  # Set to False for production trading

# Trading Settings
DEFAULT_STOP_LOSS_PCT = 0.05  # 5%
MIN_ARB_PROFIT_CENTS = 5
AUTO_MONITOR_INTERVAL = 30  # seconds

# Risk Management
MAX_POSITION_SIZE = 100  # Maximum contracts per trade
MAX_TOTAL_EXPOSURE = 1000  # Maximum total exposure in cents

# Server Settings
HOST = '0.0.0.0'
PORT = 5000
DEBUG = True
