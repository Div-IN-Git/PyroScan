import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from model_loader import model_loader
import time

print("Initial state:", model_loader.state, model_loader.model_name)
time.sleep(2)
print("After wait:", model_loader.state, model_loader.model_name)
