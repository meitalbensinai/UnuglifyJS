#!/usr/bin/python

import multiprocessing
import os
import sys
import shutil
import re
from threading import Timer
import subprocess
from subprocess import Popen,PIPE, STDOUT, call

def PrintUsage():
  print """
Usage:
  printRanks.py --dir <directory> --nice2predict_server <server> --logfile <filename> --resultsfile <filename> [--original_features] --num_threads <number> 
  --max_path_length <number>  --max_path_width <number> --no-timeout --topk <number>
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

MAX_PATH_WIDTH = 0
if (len(sys.argv) > 15):
	MAX_PATH_WIDTH = int(sys.argv[15])
  
LOGFILE = sys.argv[6]
RESULTSFILE = sys.argv[8]

original_features_flag = ""
if ((len(sys.argv) > 9) and (sys.argv[9] == '--original_features')):
  original_features_flag = '--original_features'
  
kill = lambda process: process.kill()
if (len(sys.argv) > 16):
	if (sys.argv[16] == '--no-timeout'):
		kill = lambda process: 1

topk = sys.argv[18]

def EvaluateFile(f):
  nodejsCommand = ['nodejs', '--max_old_space_size=64000', 'bin/unuglifyjs', f, '--topk=' + str(topk), '--nice2predict_server=' + SERVER, '--max_path_length=' + str(MAX_PATH_LENGTH), '--max_path_width=' + str(MAX_PATH_WIDTH), '--skip_minified']
  
  with open(TMP_DIR + str(os.getpid()), 'a') as outputFile:
    sleeper = subprocess.Popen(nodejsCommand, stdout=outputFile, stderr=subprocess.PIPE)
    timer = Timer(300, kill, [sleeper])

    try:
      timer.start()
      stdout, stderr = sleeper.communicate()
    finally:
      timer.cancel()

    if (sleeper.poll() == 0):
      if (len(stderr) > 0):
        print >> sys.stderr, stderr,
    else:
      print >> sys.stderr, 'file: ' + str(f) + ' was not completed in time'

def EvaluateFileList(files):
  global TMP_DIR
  TMP_DIR = "./tmp/evaluate_dir%d/" % (os.getpid())
  if os.path.exists(TMP_DIR):
    shutil.rmtree(TMP_DIR)
  os.makedirs(TMP_DIR)
  try:
    p = multiprocessing.Pool(NUM_THREADS)
    p.map(EvaluateFile, files)
    output_files = os.listdir(TMP_DIR)

    among_topk = 0
    total_predictions = 0
    
    with open(LOGFILE, "a") as logFile:
      for f in output_files:
        with open(TMP_DIR + "/" + f) as opened_file:
          lines = [line.rstrip('\n') for line in opened_file]
          for index,line in enumerate(lines):
            logFile.write(line + "\n")
            total_predictions += 1
            if (line != "-1"):
              among_topk += 1
    
    print str(among_topk) + " / " + str(total_predictions)
    print float(among_topk)/total_predictions

    with open(RESULTSFILE, "a") as resultsFile:
      resultsFile.write(str(among_topk) + " / " + str(total_predictions) + "\n")
      #resultsFile.write(str(float(among_topk)/total_predictions) + "\n")
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
  files = [f for f in files if (not f.endswith('.min.js') and not f.endswith("-min.js"))]
  EvaluateFileList(files)

