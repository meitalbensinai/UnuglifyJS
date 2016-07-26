#!/usr/bin/python

import multiprocessing
import os
import sys
import shutil
from subprocess import Popen,PIPE, STDOUT
import time

def PrintUsage():
  print """
Usage:
  path_length_test.py --training_dir <directory> --test_dir <directory> --nice2predict_server <server> --path_lengths <comma-separated-list> --num_threads <number>
"""
  exit(1)

def GetJSFilesInDir(d):
  for root, _, files in os.walk(d):
    for f in files:
      fname = os.path.join(root, f)
      if fname.endswith('.js'):
        yield fname


TMP_DIR = ""

def EvaluateFile(f):
  global TMP_DIR
  original_features_flag = ""
  if (sys.argv[5] == '--original_features'):
      original_features_flag = '--original_features'

  nodejsCommand = "nodejs bin/unuglifyjs '%s' --evaluate %s --nice2predict_server=%s >> %s/%d" % (f, original_features_flag, SERVER, TMP_DIR, os.getpid())
  #nodejsCommand = "nodejs bin/unuglifyjs '%s' --evaluate --nice2predict_server=%s" % (f, SERVER)
  os.system(nodejsCommand)

def EvaluateFileList(files):
  global TMP_DIR
  TMP_DIR = "./tmp/evaluate_dir%d" % (os.getpid())
  if os.path.exists(TMP_DIR):
    shutil.rmtree(TMP_DIR)
  os.makedirs(TMP_DIR)
  try:
    p = multiprocessing.Pool(multiprocessing.cpu_count())
    p.map(EvaluateFile, files)
    output_files = os.listdir(TMP_DIR)
    correct_predictions = 0
    total_predictions = 0

    for f in output_files:
      #os.system("cat %s/%s" % (TMP_DIR, f))
      with open(TMP_DIR + "/" + f) as opened_file:
        lines = [line.rstrip('\n') for line in opened_file]
        for index,line in enumerate(lines):
          if (index == 0):
            print "in file: " + line
          elif (index == len(lines) - 1):
            parts = line.split()
            correct_predictions += int(parts[0])
            total_predictions += int(parts[1])
          else:
            print line
    print "%s / %s" % (correct_predictions, total_predictions)
  finally:
    shutil.rmtree(TMP_DIR)


if __name__ == '__main__':
  if (len(sys.argv) <= 8):
    PrintUsage()

  training_dir = sys.argv[2]
  if (sys.argv[7] == "--path_lengths"):
    path_lengths = [int(single_length) for single_length in sys.argv[8].split(',')]
  if (sys.argv[3] == "--test_dir"):
    test_dir = sys.argv[4]
  if (sys.argv[5] == "--nice2predict_server"):
    server = sys.argv[6]
  num_threads = 1
  if ((len(sys.argv) > 10) and sys.argv[9] == '--num_threads'):
    num_threads = int(sys.argv[10])
  
  #EvaluateFileList(files)
  for max_length_candidate in path_lengths:
    command = "./extract_features.py --dir %s --max_path_length %d > training_data_%d" % (training_dir, max_length_candidate, max_length_candidate)
    print command
    os.system(command)
    
    os.chdir("../Nice2Predict")
    command = "bin/training/train --logtostderr -num_threads %d  --input ./../UnuglifyJS/training_data_%d" % (num_threads, max_length_candidate)
    print command
    os.system(command)
    

    command = "./bin/server/nice2server --logtostderr"
    print command
    server_process = Popen(["./bin/server/nice2server", "--logtostderr"], stdout=PIPE, bufsize=1, stderr=STDOUT)
    #time.sleep(3)
    try:
      server_is_up = False
      while not server_is_up:
        nextline = server_process.stdout.readline()
        if nextline.find("Nice2Server started") >= 0:
          server_is_up = True
          print 'Nice2Server started'

      os.chdir("../UnuglifyJS")
      command = "python ./evaluate_dir.py --dir %s --server %s --logfile evaluation_%d --resultsfile results_%d" % (test_dir, server, max_length_candidate, max_length_candidate)
      #command = "python ./evaluate_dir.py --dir %s --server %s" % (test_dir, server)
      print command
      os.system(command)
    finally:
      server_process.send_signal(2)
      print "Nice2Server stopped"


  # Test original
  command = "./extract_features.py --dir %s --original_features > training_data_0" % (training_dir)
  print command
  os.system(command)
  
  os.chdir("../Nice2Predict")
  command = "bin/training/train --logtostderr -num_threads %d  --input ./../UnuglifyJS/training_data_0" % (num_threads)
  print command
  os.system(command)
  

  command = "./bin/server/nice2server --logtostderr"
  print command
  server_process = Popen(["./bin/server/nice2server", "--logtostderr"], stdout=PIPE, bufsize=1, stderr=STDOUT)
  #time.sleep(3)
  try:
    server_is_up = False
    while not server_is_up:
      nextline = server_process.stdout.readline()
      if nextline.find("Nice2Server started") >= 0:
        server_is_up = True
        print 'Nice2Server started'

    os.chdir("../UnuglifyJS")
    command = "python ./evaluate_dir.py --dir %s --server %s --logfile evaluation_0 --resultsfile results_0  --original_features" % (test_dir, server)

    print command
    os.system(command)
  finally:
    server_process.send_signal(2)
    print "Nice2Server stopped"

  for max_length_candidate in path_lengths:
    with open("results_%d" % (max_length_candidate), "r") as resultsFile:
      line = resultsFile.readline().strip()
    print("MAX PATH LENGTH=%d: %s" % (max_length_candidate, line))
  with open("results_0", "r") as resultsFile:
      line = resultsFile.readline().strip()
  print("ORIGINAL UnuglifyJS: %s" % line)

