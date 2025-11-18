import { expect } from 'chai';
import { allScenes } from '../lib/scenes/all_scenes';
import { configureTest } from '../lib/utils/configure_test';

for (const scene of allScenes) {
  describe(`(${scene}): absorb`, function () {
    configureTest(this, scene);

    it('Can absorb a simple change into a single commit', () => {
      // Create branch with commit A
      scene.repo.createChangeAndCommit('original content', 'file.txt');
      scene.repo.runCliCommand(['create', 'a', '-m', 'Add file']);

      // Modify the file that was added in the previous commit
      scene.repo.createChange('fixed content', 'file.txt');
      scene.repo.runGitCommand(['add', '.']);

      // Absorb should amend the commit in the parent branch
      scene.repo.runCliCommand(['absorb', '--force']);

      // Verify the commit now has the fixed content
      scene.repo.runGitCommand(['checkout', 'main']);
      const content = scene.repo.runGitCommandAndGetOutput(['show', 'HEAD:file.txt']);
      expect(content.trim()).to.equal('fixed content');
    });

    it('Shows error when no staged changes', () => {
      scene.repo.createChange('a', 'file.txt');
      scene.repo.runCliCommand(['create', 'a', '-m', 'Add file']);

      // Try to absorb without staging
      expect(() => scene.repo.runCliCommand(['absorb'])).to.throw();
    });

    it('Shows error when branch is not tracked', () => {
      // Create untracked branch
      scene.repo.runGitCommand(['checkout', '-b', 'untracked']);
      scene.repo.createChangeAndCommit('a', 'file.txt');

      scene.repo.createChange('b', 'file.txt');
      scene.repo.runGitCommand(['add', 'file.txt']);

      // Try to absorb on untracked branch
      expect(() => scene.repo.runCliCommand(['absorb'])).to.throw();
    });

    it('Handles --dry-run without modifying commits', () => {
      scene.repo.createChangeAndCommit('original', 'file.txt');
      const originalSha = scene.repo.runGitCommandAndGetOutput(['rev-parse', 'HEAD']).trim();
      
      scene.repo.runCliCommand(['create', 'a', '-m', 'Branch a']);

      scene.repo.createChange('fixed', 'file.txt');
      scene.repo.runGitCommand(['add', '.']);

      // Dry run
      scene.repo.runCliCommand(['absorb', '--dry-run']);

      // Verify parent commit unchanged
      scene.repo.runGitCommand(['checkout', 'main']);
      const newSha = scene.repo.runGitCommandAndGetOutput(['rev-parse', 'HEAD']).trim();
      expect(newSha).to.equal(originalSha);
    });

    it('Handles --all flag to stage changes', () => {
      scene.repo.createChangeAndCommit('original', 'file.txt');
      scene.repo.runCliCommand(['create', 'a', '-m', 'Branch a']);

      scene.repo.createChange('fixed', 'file.txt');
      // Don't stage

      scene.repo.runCliCommand(['absorb', '--all', '--force']);

      scene.repo.runGitCommand(['checkout', 'main']);
      const content = scene.repo.runGitCommandAndGetOutput(['show', 'HEAD:file.txt']);
      expect(content.trim()).to.equal('fixed');
    });

    it('Warns when no hunks can be matched', () => {
      scene.repo.createChangeAndCommit('a', 'file.txt');
      scene.repo.runCliCommand(['create', 'a', '-m', 'Branch a']);

      // Create a new file (not modifying existing lines from downstack)
      scene.repo.createChange('b', 'newfile.txt');
      scene.repo.runGitCommand(['add', '.']);

      // Should warn and not absorb
      const output = scene.repo.runCliCommandAndGetOutput(['absorb', '--force']);
      expect(output).to.include('No hunks could be matched');
    });
  });
}
