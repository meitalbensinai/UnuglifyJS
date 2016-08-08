#!/usr/bin/python

import multiprocessing
import os
import sys
import shutil
import re
from subprocess import Popen,PIPE, STDOUT, call

def PrintUsage():
  print """
Usage:
  evaluate_dir.py --dir <directory> --nice2predict_server <server> --logfile <filename> --resultsfile <filename> [--original_features] --num_threads <number> --max_path_length <number>
"""
  exit(1)

def GetJSFilesInDir(d):
  for root, _, files in os.walk(d):
    for f in files:
      fname = os.path.join(root, f)
      if fname.endswith('.js'):
        yield fname


TMP_DIR = ""
SERVER = "";
if (len(sys.argv) > 4):
  SERVER = sys.argv[4]
else:
  SERVER = "www.nice2predict.org:5745"

NUM_THREADS = 1
if (len(sys.argv) > 11):
  NUM_THREADS = int(sys.argv[11])

MAX_PATH_LENGTH = 0
if (len(sys.argv) > 13):
	MAX_PATH_LENGTH = int(sys.argv[13])
  
LOGFILE = sys.argv[6]
RESULTSFILE = sys.argv[8]

def EvaluateFile(f):
  global TMP_DIR
  original_features_flag = ""
  if ((len(sys.argv) > 9) and (sys.argv[9] == '--original_features')):
      original_features_flag = '--original_features'
  
  nodejsCommand = "nodejs --max_old_space_size=64000 bin/unuglifyjs '%s' --evaluate %s --nice2predict_server=%s --max_path_length=%d >> %s/%d" % (f, original_features_flag, SERVER, MAX_PATH_LENGTH, TMP_DIR, os.getpid())
  #nodejsCommand = "nodejs bin/unuglifyjs '%s' --evaluate --nice2predict_server=%s" % (f, SERVER)
  #print nodejsCommand
  os.system(nodejsCommand)

def EvaluateFileList(files):
  global TMP_DIR
  resultRegex = re.compile('^\d* \d*$')
  TMP_DIR = "./tmp/evaluate_dir%d" % (os.getpid())
  if os.path.exists(TMP_DIR):
    shutil.rmtree(TMP_DIR)
  os.makedirs(TMP_DIR)
  try:
    p = multiprocessing.Pool(NUM_THREADS)
    p.map(EvaluateFile, files)
    output_files = os.listdir(TMP_DIR)
    correct_predictions = 0
    total_predictions = 0
    
    with open(LOGFILE, "a") as logFile:
      for f in output_files:
        #os.system("cat %s/%s" % (TMP_DIR, f))
        with open(TMP_DIR + "/" + f) as opened_file:
          lines = [line.rstrip('\n') for line in opened_file]
          for index,line in enumerate(lines):
            message = ""
            if (line.startswith("./")):
              message = "in file: " + line
            elif (resultRegex.match(line)):
              parts = line.split()
              correct_predictions += int(parts[0])
              total_predictions += int(parts[1])
            else:
              message = line
            if (len(message) > 0):
              print message
              logFile.write(message + "\n")
    final_sum = "%s / %s" % (correct_predictions, total_predictions)
    print final_sum
    with open(LOGFILE, "a") as logFile:
      logFile.write(final_sum + "\n")
    with open(RESULTSFILE, "a") as resultsFile:
      resultsFile.write(final_sum + "\n")
  finally:
    shutil.rmtree(TMP_DIR)


if __name__ == '__main__':
  if (len(sys.argv) <= 1):
    PrintUsage()

  if os.path.exists(LOGFILE):
     os.remove(LOGFILE)
  if os.path.exists(RESULTSFILE):
     os.remove(RESULTSFILE)

  # Process command line arguments
  if (sys.argv[1] == "--dir"):
    files = [f for f in GetJSFilesInDir(sys.argv[2])]
  else:
    PrintUsage()
  # Remove files that say they are minified.
  files = [f for f in files if not f.endswith('.min.js')]
  EvaluateFileList(files)

