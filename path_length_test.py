#!/usr/bin/python

import multiprocessing
import os
import sys
import shutil
from subprocess import Popen,PIPE, STDOUT, call
import time

def PrintUsage():
  print """
Usage:
  path_length_test.py --training_dir <directory> --test_dir <directory> --nice2predict_server <server> --path_lengths <comma-separated-list> --num_threads <number> --path_width <number>
"""
  exit(1)

def GetJSFilesInDir(d):
  for root, _, files in os.walk(d):
    for f in files:
      fname = os.path.join(root, f)
      if fname.endswith('.js'):
        yield fname


TMP_DIR = ""


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
  path_width = 0;
  if ((len(sys.argv) > 12) and sys.argv[11] == '--path_width'):
    path_width = int(sys.argv[12])
  
  #EvaluateFileList(files)
  for max_length_candidate in path_lengths:
    command = "./extract_features.py --dir %s --max_path_length %d --max_path_width %d > training_data_%dx%d" % (training_dir, max_length_candidate, path_width, max_length_candidate, path_width)
    print command
    os.system(command)
    
    os.chdir("../Nice2Predict")
    command = "bin/training/train -num_threads %d  --input ./../UnuglifyJS/training_data_%dx%d -training_method pl" % (num_threads, max_length_candidate, path_width)
    print command
    exit_code = call(command.split(' '))
    if (exit_code != 0):
      print "Training failed for max path length = %d, exiting" % max_length_candidate
      sys.exit(0)

    command = "./bin/server/nice2server"
    print command
    server_process = Popen(["./bin/server/nice2server"], stdout=PIPE, bufsize=1, stderr=STDOUT)
    #time.sleep(3)
    try:
      server_is_up = False
      while not server_is_up:
        nextline = server_process.stdout.readline()
        print nextline
        if nextline.find("Nice2Server started") >= 0:
          server_is_up = True
          print 'Nice2Server started'

      os.chdir("../UnuglifyJS")
      command = "python ./evaluate_dir.py --dir %s --server %s --logfile evaluation_%dx%d --resultsfile results_%dx%d --empty --num_threads %d --max_path_length %d --max_path_width %d" % (test_dir, server, max_length_candidate, path_width, max_length_candidate, path_width, multiprocessing.cpu_count(), max_length_candidate, path_width)
      print command
      os.system(command)
    finally:
      server_process.send_signal(2)
      print "Nice2Server stopped"


  # Test original
  '''command = "./extract_features.py --dir %s --original_features > training_data_0" % (training_dir)
  print command
  os.system(command)
  
  os.chdir("../Nice2Predict")
  command = "bin/training/train -num_threads %d  --input ./../UnuglifyJS/training_data_0 -training_method pl -beam_size 16" % (num_threads)
  print command
  exit_code = call(command.split(' '))
  if (exit_code != 0):
      print "Training failed for original features, exiting" 
      sys.exit(0)

  command = "./bin/server/nice2server"
  print command
  server_process = Popen(["./bin/server/nice2server"], stdout=PIPE, bufsize=1, stderr=STDOUT)
  #time.sleep(3)
  try:
    server_is_up = False
    while not server_is_up:
      nextline = server_process.stdout.readline()
      print nextline
      if nextline.find("Nice2Server started") >= 0:
        server_is_up = True
        print 'Nice2Server started'

    os.chdir("../UnuglifyJS")
    command = "python ./evaluate_dir.py --dir %s --server %s --logfile evaluation_0 --resultsfile results_0  --original_features --num_threads %d --max_path_length %d" % (test_dir, server, multiprocessing.cpu_count(), 0)

    print command
    os.system(command)
  finally:
    server_process.send_signal(2)
    print "Nice2Server stopped"
'''

  print("Max path width=%d" % (path_width))
  for max_length_candidate in path_lengths:
    with open("results_%dx%d" % (max_length_candidate, path_width), "r") as resultsFile:
      line = resultsFile.readline().strip()
    print("MAX PATH LENGTH=%d: %s" % (max_length_candidate, line))

  #print("ORIGINAL UnuglifyJS: %s" % line)

