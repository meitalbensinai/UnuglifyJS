import os
import json
from git import Repo
import time

def scandirs(path):
	for root, dirs, files in os.walk(path):
		for currentFile in files:
			#print "Processing file: " + currentFile
			if (((not currentFile.lower().endswith('.js')) and (not currentFile.lower() == "tempfile")) or (currentFile.lower().endswith('.min.js'))):
				#print "deleting: " + currentFile
				os.remove(os.path.join(root, currentFile))

base = '/home/urialon/mining'
subdir = '/topstars/'
sortBy = 'stars'
language = 'JavaScript'

os.chdir(base + subdir)
for i in range(1, 20):
        succeeded = False
        while (not succeeded):
            print 'page = ' + str(i)
            command = "curl -H 'Accept: application/vnd.github.v3.text-match+json'   'https://api.github.com/search/repositories?q=language:" + language + "&sort=" + sortBy + "&order=desc&page=" + str(i) + "&per_page=100'"
            os.system(command + ' > tempfile')
            with open('tempfile') as result:
                data = json.load(result)
                if not data.has_key('items'):
                    print "GitHub returned bad result - sleeping"
                    time.sleep(60*5);
                    continue
                else:
                    succeeded = True
                for repository in data['items']: 
                    succeeded = True
                    url = repository['git_url']
                    name = repository['name']
                    if (not os.path.isdir(base + "/topstars/" + name) and not os.path.isdir(base + subdir + name)):
                        print 'Cloning url: ' + url
                        Repo.clone_from(url, name)
                        scandirs(base + subdir + name)
                    else:
                        print 'Repo already exists: ' + url
